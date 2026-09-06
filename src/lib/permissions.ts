/**
 * Permission vocabulary & default role definitions.
 *
 * This module is pure (zero I/O) so it can be imported by both server actions
 * and unit tests. It defines the resource-and-action permission model
 * (`resource.action`) and the canned permission sets for each system role.
 *
 * Roles are attached to users through `OrganizationMembership`, never on the
 * User row itself. This decouples "who you are" from "what you can do" and lets
 * each organisation customise its own roles without code changes.
 */

// ---------------------------------------------------------------------------
// Resource + Action vocabulary
// ---------------------------------------------------------------------------

export type Resource =
	| "invoices"
	| "payments"
	| "expenses"
	| "projects"
	| "customers"
	| "estimates"
	| "changeOrders"
	| "timeEntries"
	| "catalog"
	| "reports"
	| "team"
	| "settings"
	| "templates";

export type Action = "view" | "create" | "edit" | "delete" | "send" | "approve" | "void" | "export" | "invite" | "remove";

export type Permission = `${Resource}.${Action}`;

/** Invoice lifecycle states. `PENDING_REVIEW` and `APPROVED` are introduced by
 * the permission-aware state machine; the legacy enum kept `UNSENT`/`OVERDUE`
 * but these are intentionally excluded from state-driven authorisation to keep
 * the transition graph predictable. */
export type InvoiceState =
	| "DRAFT"
	| "PENDING_REVIEW"
	| "APPROVED"
	| "SENT"
	| "PARTIALLY_PAID"
	| "PAID"
	| "VOID";

/** Actions that carry financial/state implications and therefore need to be
 * checked against the invoice's current state. */
export type InvoiceAction = "view" | "create" | "edit" | "send" | "approve" | "void" | "delete";

/** Maps an invoice action to its permission string. */
export const INVOICE_ACTION_PERMISSION: Record<InvoiceAction, Permission> = {
	view: "invoices.view",
	create: "invoices.create",
	edit: "invoices.edit",
	send: "invoices.send",
	approve: "invoices.approve",
	void: "invoices.void",
	delete: "invoices.delete",
};

// ---------------------------------------------------------------------------
// The full, canonical set of permissions (used to validate & enumerate)
// ---------------------------------------------------------------------------

export const ALL_PERMISSIONS: Permission[] = [
	"invoices.view",
	"invoices.create",
	"invoices.edit",
	"invoices.send",
	"invoices.approve",
	"invoices.void",
	"invoices.delete",
	"payments.view",
	"payments.create",
	"expenses.view",
	"expenses.create",
	"projects.view",
	"projects.create",
	"customers.view",
	"customers.create",
	"estimates.view",
	"estimates.create",
	"changeOrders.view",
	"changeOrders.create",
	"timeEntries.view",
	"timeEntries.create",
	"catalog.view",
	"catalog.create",
	"reports.view",
	"reports.export",
	"team.invite",
	"team.remove",
	"settings.edit",
	"templates.edit",
];

/**
 * Permissions that are inherently organisation-scoped (not tied to a single
 * project / invoice instance). Everything not listed here is also org-scoped by
 * default for the purposes of membership resolution, but these are the ones that
 * must never be granted at the project level.
 */
export const ORG_SCOPE_ONLY: Permission[] = [
	"team.invite",
	"team.remove",
	"settings.edit",
];

// ---------------------------------------------------------------------------
// System roles
// ---------------------------------------------------------------------------

export interface SystemRoleDef {
	id: string;
	name: string;
	label: string;
	description: string;
	isSystem: true;
}

/** Immutable, built-in roles. `id` is stable and used by the seed/data layer. */
export const SYSTEM_ROLES: SystemRoleDef[] = [
	{
		id: "owner",
		name: "Owner",
		label: "Owner",
		description: "Full access to every part of the organisation, including billing and team management.",
		isSystem: true,
	},
	{
		id: "administrator",
		name: "Administrator",
		label: "Admin / Office Manager",
		description: "Manages day-to-day operations. Can create, send, and approve invoices and most settings, but cannot void invoices or delete financial records.",
		isSystem: true,
	},
	{
		id: "accountant",
		name: "Accountant",
		label: "Accountant",
		description: "Handles finances: create, edit, send and approve invoices, record payments, and review reports. Cannot manage the team or void invoices.",
		isSystem: true,
	},
	{
		id: "project_manager",
		name: "Project Manager",
		label: "Project Manager",
		description: "Project-scoped access. Can create and send invoices for assigned projects, but cannot approve, void, or view organisation-wide reports.",
		isSystem: true,
	},
	{
		id: "field_worker",
		name: "Field Worker",
		label: "Field Worker",
		description: "Limited, project-scoped access to view projects and log time entries. Cannot create or edit invoices.",
		isSystem: true,
	},
];

/** Stable order preserved when rendering the role picker. Owner first. */
export const SYSTEM_ROLE_IDS = ["owner", "administrator", "accountant", "project_manager", "field_worker"] as const;

export type SystemRoleId = (typeof SYSTEM_ROLE_IDS)[number];

/**
 * The canonical permission set for each system role.
 *
 * - Owner gets everything.
 * - Administrator gets everything except `invoices.void` and `invoices.delete`
 *   (destructive financial actions are restricted to the Owner).
 * - Accountant gets invoice create/edit/send/approve + payments + expenses +
 *   reports, but no team/settings, no void, no delete, no project creation.
 * - Project Manager gets project-scoped invoice create/edit/send (no approve,
 *   no void), plus customer/estimate read access.
 * - Field Worker gets read-only access to projects and invoices, plus the
 *   ability to create their own time entries.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRoleId, Permission[]> = {
	owner: [...ALL_PERMISSIONS],
	administrator: [
		"invoices.view",
		"invoices.create",
		"invoices.edit",
		"invoices.send",
		"invoices.approve",
		"invoices.void",
		"payments.view",
		"payments.create",
		"expenses.view",
		"expenses.create",
		"projects.view",
		"projects.create",
		"customers.view",
		"customers.create",
		"estimates.view",
		"estimates.create",
		"changeOrders.view",
		"changeOrders.create",
		"timeEntries.view",
		"timeEntries.create",
		"catalog.view",
		"catalog.create",
		"reports.view",
		"reports.export",
		"team.invite",
		"team.remove",
		"settings.edit",
		"templates.edit",
	],
	accountant: [
		"invoices.view",
		"invoices.create",
		"invoices.edit",
		"invoices.send",
		"invoices.approve",
		"payments.view",
		"payments.create",
		"expenses.view",
		"expenses.create",
		"projects.view",
		"customers.view",
		"customers.create",
		"estimates.view",
		"timeEntries.view",
		"catalog.view",
		"reports.view",
		"reports.export",
		"templates.edit",
	],
	project_manager: [
		"invoices.view",
		"invoices.create",
		"invoices.edit",
		"invoices.send",
		"projects.view",
		"customers.view",
		"timeEntries.view",
		"estimates.view",
	],
	field_worker: [
		"invoices.view",
		"projects.view",
		"customers.view",
		"timeEntries.view",
		"timeEntries.create",
	],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse `"resource.action"` into its parts. Returns null for unknown perms. */
export function parsePermission(perm: string): { resource: Resource; action: Action } | null {
	const [resource, action] = perm["split"](".") as [string, string | undefined];
	if (!resource || !action) return null;
	return { resource: resource as Resource, action: action as Action };
}

/** Re-join parts into a canonical permission string. */
export function permissionToString(resource: Resource, action: Action): Permission {
	return `${resource}.${action}`;
}

/** True when `perm` is a known, valid permission string. */
export function isValidPermission(perm: string): perm is Permission {
	return (ALL_PERMISSIONS as string[])["includes"](perm);
}

/** Return the system role definition for a role id, or null. */
export function getSystemRole(id: string): SystemRoleDef | null {
	return SYSTEM_ROLES["find"]((r) => r["id"] === id) ?? null;
}

/** Whether a role id is one of the immutable system roles. */
export function isSystemRole(id: string): boolean {
	return SYSTEM_ROLE_IDS["includes"](id as SystemRoleId);
}

/**
 * Validate a list of permission strings. Returns the subset that are invalid.
 */
export function findInvalidPermissions(perms: string[]): string[] {
	return perms["filter"]((p) => !isValidPermission(p));
}

/**
 * Permissions required to perform each invoice action, keyed by action.
 * Used by the state machine to look up the permission before considering the
 * current state.
 */
export function permissionForInvoiceAction(action: InvoiceAction): Permission {
	return INVOICE_ACTION_PERMISSION[action];
}

/** All invoice-state-related permissions in one place for state checks. */
export const INVOICE_PERMISSIONS = [
	"invoices.view",
	"invoices.create",
	"invoices.edit",
	"invoices.send",
	"invoices.approve",
	"invoices.void",
	"invoices.delete",
] as const;
