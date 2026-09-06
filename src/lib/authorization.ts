/**
 * Centralised authorisation service.
 *
 * This is the single entry point that server actions and route handlers should
 * use to decide whether a user may perform an action. It resolves a user's
 * permission set from the membership → role → permission graph (with graceful
 * fallback to the legacy `role` column when the new tables are not yet
 * migrated) and then delegates the *decision* to the pure policy in
 * `authorization-policy.ts`.
 *
 * Decision logic is never duplicated in route handlers: hiding a button is not a
 * security mechanism, so every financial mutation flows through here.
 */

import { db } from "@/lib/db";
import { withRetry, isMissingColumnError } from "@/lib/db-drift";
import { logServerError } from "@/lib/errors";
import type { Permission, InvoiceState, InvoiceAction } from "@/lib/permissions";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import {
	canPerformInvoiceAction,
	hasPermission as policyHasPermission,
	canAccessProjectResource,
	normaliseInvoiceState,
	type AuthzDecision,
} from "@/lib/authorization-policy";
import { actionError } from "@/lib/action-errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthorizeOptions {
	userId: string;
	orgId: string;
	permission: Permission;
	/** ID of a specific resource (invoice / project) for project-scoped checks. */
	resourceId?: string;
	/** The kind of resource `resourceId` refers to. */
	resourceType?: "invoice" | "project";
	/** Current invoice state (for state-aware financial actions). */
	invoiceState?: InvoiceState;
	/** Optional target state the action would move the invoice to. */
	targetState?: InvoiceState;
}

/** A resolved permission bundle for a user in one organisation. */
export interface ResolvedPermissions {
	permissions: Permission[];
	/** Project-scoped permission sets keyed by projectId. */
	projectPermissions: Record<string, Permission[]>;
}

// ---------------------------------------------------------------------------
// Legacy fallback (OrgRole enum → system role permissions)
// ---------------------------------------------------------------------------
// When the membership/role tables are not yet present in the database the
// service falls back to the legacy `role` column. This mapping lets us treat
// the old OWNER/ADMIN/MEMBER/VIEWER values as approximation sets so the rest of
// the app keeps working during a staged rollout.

const LEGACY_ROLE_TO_PERMISSIONS: Record<string, Permission[]> = {
	OWNER: DEFAULT_ROLE_PERMISSIONS["owner"],
	ADMIN: DEFAULT_ROLE_PERMISSIONS["administrator"],
	MEMBER: DEFAULT_ROLE_PERMISSIONS["project_manager"],
	VIEWER: DEFAULT_ROLE_PERMISSIONS["field_worker"],
};

function legacyPermissions(role: string): Permission[] {
	return LEGACY_ROLE_TO_PERMISSIONS[role] ?? LEGACY_ROLE_TO_PERMISSIONS["VIEWER"] ?? [];
}

/**
 * Resolve the *organisation-level* permission set for a user.
 *
 * Tries the membership table first; on schema drift (table/column missing) it
 * falls back to the legacy `User.role` column so the app remains functional on
 * partially-migrated databases.
 */
export async function resolveOrgPermissions(userId: string, orgId: string): Promise<Permission[]> {
	try {
		const memberships = await withRetry(() =>
			db["organizationMembership"]["findMany"]({
				where: { userId, orgId },
				include: {
					role: {
						include: {
							permissions: { select: { permission: true } },
						},
					},
				},
			})
		);
		const perms = new Set<Permission>();
		for (const m of memberships) {
			for (const rp of m["role"]?.["permissions"] ?? []) {
				perms["add"](rp["permission"] as Permission);
			}
		}
		if (perms["size"] > 0) return Array["from"](perms);
		// Membership exists but role has no explicit permissions — treat as
		// no access rather than falling through.
		return [];
	} catch (err) {
		if (!isMissingColumnError(err)) {
			logServerError("resolveOrgPermissions", err);
			return [];
		}
	}

	// Fallback: legacy role column on the User row.
	try {
		const user = await withRetry(() =>
			db["user"]["findUnique"]({
				where: { id: userId },
				select: { role: true },
			})
		);
		return legacyPermissions(user?.["role"] ?? "VIEWER");
	} catch (err) {
		logServerError("resolveOrgPermissions (legacy fallback)", err);
		return [];
	}
}

/**
 * Resolve the *project-level* permission set for a user on a single project.
 *
 * A project member may carry an `OrganizationRole` via `roleId`; resolving that
 * role's permissions yields the project-scoped grant set. Returns an empty set
 * when the user is not a project member (or the tables are absent).
 */
export async function resolveProjectPermissions(
	userId: string,
	orgId: string,
	projectId: string
): Promise<Permission[]> {
	try {
		const member = await withRetry(() =>
			db["projectMember"]["findFirst"]({
				where: { orgId, projectId, userId: userId ?? "" },
				include: {
					roleRef: {
						include: {
							permissions: { select: { permission: true } },
						},
					},
				},
			})
		);
		if (!member) return [];
		const perms = new Set<Permission>();
		for (const rp of member["roleRef"]?.["permissions"] ?? []) {
			perms["add"](rp["permission"] as Permission);
		}
		return Array["from"](perms);
	} catch (err) {
		if (!isMissingColumnError(err)) {
			logServerError("resolveProjectPermissions", err);
		}
		return [];
	}
}

/**
 * Resolve every permission a user holds: organisation-level + all applicable
 * project-level sets. This is the data source for the pure `authorize()` policy.
 */
export async function resolveUserPermissions(userId: string, orgId: string): Promise<ResolvedPermissions> {
	const permissions = await resolveOrgPermissions(userId, orgId);

	const projectPermissions: Record<string, Permission[]> = {};
	try {
		const projectMemberships = await withRetry(() =>
			db["projectMember"]["findMany"]({
				where: { orgId, userId: userId ?? "" },
				select: { projectId: true },
			})
		);
		for (const pm of projectMemberships) {
			projectPermissions[pm["projectId"]] = await resolveProjectPermissions(userId, orgId, pm["projectId"]);
		}
	} catch (err) {
		if (!isMissingColumnError(err)) {
			logServerError("resolveUserPermissions (project scan)", err);
		}
	}

	return { permissions, projectPermissions };
}

// ---------------------------------------------------------------------------
// Public decision API
// ---------------------------------------------------------------------------

/**
 * The central `authorize(user, organization, permission, resource)` service.
 *
 * Resolves the caller's permissions from the store, then applies the pure
 * policy from `authorization-policy.ts`. Returns a structured decision so the
 * caller can surface a precise reason.
 *
 * The check is **state-aware** for invoices: pass `invoiceState`/`targetState`
 * to enforce that an action is allowed for the invoice's current lifecycle
 * stage (e.g. a Project Manager may send a draft invoice but not void one).
 */
export async function authorize(opts: AuthorizeOptions): Promise<AuthzDecision> {
	const { userId, orgId, permission, resourceId, resourceType, invoiceState, targetState } = opts;

	const { permissions, projectPermissions } = await resolveUserPermissions(userId, orgId);

	// Invoice state-aware financial actions short-circuit to the pure policy.
	if (permission["startsWith"]("invoices.") && invoiceState !== undefined) {
		const action = invoiceActionFromPermission(permission);
		if (action) {
			return canPerformInvoiceAction(permissions, action, invoiceState);
		}
	}

	// Project-scoped resource: org-level permission wins, otherwise require a
	// project-level grant.
	if (resourceId && resourceType === "project") {
		const projPerms = projectPermissions[resourceId] ?? [];
		return canAccessProjectResource(permissions, projPerms, permission);
	}

	// Plain organisation-level permission check.
	return policyHasPermission(permissions, permission);
}

/**
 * Variant of `authorize` for a user whose permissions were already resolved
 * (avoids a second DB round-trip inside loops). Pure delegation to the policy.
 */
export function authorizeWithPermissions(
	perms: ResolvedPermissions,
	permission: Permission,
	opts: {
		projectId?: string;
		invoiceState?: InvoiceState;
	}
): AuthzDecision {
	if (opts["invoiceState"] !== undefined && permission["startsWith"]("invoices.")) {
		const action = invoiceActionFromPermission(permission);
		if (action) {
			return canPerformInvoiceAction(perms["permissions"], action, opts["invoiceState"]);
		}
	}

	if (opts["projectId"]) {
		return canAccessProjectResource(
			perms["permissions"],
			perms["projectPermissions"][opts["projectId"]] ?? [],
			permission
		);
	}

	return policyHasPermission(perms["permissions"], permission);
}

/**
 * Throw an `ActionError` unless the user is permitted to perform `action`.
 * Convenience wrapper for server-action guards.
 */
export async function requirePermission(
	userId: string,
	orgId: string,
	permission: Permission,
	opts: Omit<AuthorizeOptions, "userId" | "orgId" | "permission">
): Promise<void> {
	const decision = await authorize({ userId, orgId, permission, ...opts });
	if (!decision["allowed"]) {
		actionError(decision["reason"]);
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map an `invoices.*` permission string to the InvoiceAction it represents, or
 * null when the permission is not a state-aware invoice action (e.g. `view`).
 */
function invoiceActionFromPermission(permission: Permission): InvoiceAction | null {
	const mapping: Partial<Record<Permission, InvoiceAction>> = {
		"invoices.create": "create",
		"invoices.edit": "edit",
		"invoices.send": "send",
		"invoices.approve": "approve",
		"invoices.void": "void",
		"invoices.delete": "delete",
	};
	return mapping[permission] ?? null;
}

/**
 * Resolve the system Role document (id + permissions) the caller should see for
 * a legacy `role` value. Useful when seeding or comparing.
 */
export function permissionsForLegacyRole(role: string): Permission[] {
	return legacyPermissions(role);
}
