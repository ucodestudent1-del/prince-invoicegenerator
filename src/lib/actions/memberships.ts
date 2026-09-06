"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidatePath } from "next/cache";
import { revalidateWithLocale } from "@/lib/revalidate";
import { recordAudit } from "@/lib/audit";
import { withRetry, isMissingColumnError, isDriftError } from "@/lib/db-drift";
import { SYSTEM_ROLES, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import type { SystemRoleId, Permission } from "@/lib/permissions";
import { authorize } from "@/lib/authorization";

export interface MembershipRow {
	id: string;
	userId: string;
	name: string | null;
	email: string | null;
	image: string | null;
	roleId: string | null;
	roleName: string | null;
	isSystem: boolean;
	permissions: Permission[];
	joinedAt: Date;
}

// ---------------------------------------------------------------------------
// Seeding / migration helpers
// ---------------------------------------------------------------------------

const LEGACY_ROLE_TO_SYSTEM_ID: Record<string, SystemRoleId> = {
	OWNER: "owner",
	ADMIN: "administrator",
	MEMBER: "project_manager",
	VIEWER: "field_worker",
};

function legacyRoleToSystemId(role: string): SystemRoleId | null {
	return LEGACY_ROLE_TO_SYSTEM_ID[role] ?? null;
}

/**
 * Seed the five immutable system roles (and their permissions) for an
 * organisation. Safe to call repeatedly. Degrades gracefully when the new
 * tables are absent (schema drift), returning false.
 */
export async function ensureSystemRoles(orgId: string): Promise<boolean> {
	return withActionError("ensureSystemRoles", async () => {
		for (const role of SYSTEM_ROLES) {
			const permissions = DEFAULT_ROLE_PERMISSIONS[role["id"] as SystemRoleId] ?? [];
			try {
				await withRetry(() =>
					db["organizationRole"]["upsert"]({
						where: { id: role["id"] },
						create: {
							id: role["id"],
							orgId,
							name: role["name"],
							description: role["description"],
							isSystem: true,
							isEditable: false,
							permissions: {
								create: permissions["map"]((p) => ({ permission: p })),
							},
						},
						update: {
							permissions: {
								deleteMany: {},
								create: permissions["map"]((p) => ({ permission: p })),
							},
						},
					})
				);
			} catch (err) {
				if (isDriftError(err)) return false;
				throw err;
			}
		}
		return true;
	});
}

/**
 * Backfill `OrganizationMembership` rows for a user from their legacy
 * `role` column. Idempotent — safe to call on every login.
 */
export async function syncMembershipFromLegacyRole(userId: string, orgId: string): Promise<void> {
	return withActionError("syncMembershipFromLegacyRole", async () => {
		let legacyRole: string | null = null;
		try {
			const user = await withRetry(() =>
				db["user"]["findUnique"]({
					where: { id: userId },
					select: { role: true },
				})
			);
			legacyRole = user?.["role"] ?? null;
		} catch (err) {
			if (isMissingColumnError(err)) return;
			throw err;
		}

		if (!legacyRole) return;
		const roleId = legacyRoleToSystemId(legacyRole);
		if (!roleId) return;

		try {
			await withRetry(() =>
				db["organizationMembership"]["upsert"]({
					where: { orgId_userId: { orgId, userId } },
					create: { orgId, userId, roleId },
					update: { roleId },
				})
			);
		} catch (err) {
			if (isMissingColumnError(err)) return;
			throw err;
		}
	});
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

function toMembershipRow(m: any): MembershipRow {
	return {
		id: m["id"],
		userId: m["userId"],
		name: m["user"]?.["name"] ?? null,
		email: m["user"]?.["email"] ?? null,
		image: m["user"]?.["image"] ?? null,
		roleId: m["roleId"] ?? null,
		roleName: m["role"]?.["name"] ?? null,
		isSystem: m["role"]?.["isSystem"] ?? false,
		permissions: m["role"]?.["permissions"]?.["map"]((p: any) => p["permission"] as Permission) ?? [],
		joinedAt: m["createdAt"],
	};
}

/** List every member of the organisation with their resolved role + perms. */
export async function listMemberships(orgId: string): Promise<MembershipRow[]> {
	return withActionError("listMemberships", async () => {
		try {
			const rows = await withRetry(() =>
				db["organizationMembership"]["findMany"]({
					where: { orgId },
					include: {
						user: { select: { id: true, name: true, email: true, image: true } },
						role: { include: { permissions: { select: { permission: true } } } },
					},
					orderBy: { createdAt: "asc" },
				})
			);
			return rows["map"](toMembershipRow);
		} catch (err) {
			if (!isMissingColumnError(err)) throw err;
			// Fallback: legacy user.role column.
			const users = await withRetry(() =>
				db["user"]["findMany"]({
					where: { organizationId: orgId },
					select: { id: true, name: true, email: true, image: true, role: true, createdAt: true },
					orderBy: { createdAt: "asc" },
				})
			);
			return users["map"](
				(u): MembershipRow => ({
					id: u["id"],
					userId: u["id"],
					name: u["name"],
					email: u["email"],
					image: u["image"],
					roleId: null,
					roleName: u["role"],
					isSystem: true,
					permissions: DEFAULT_ROLE_PERMISSIONS[legacyRoleToSystemId(u["role"] as any) ?? "field_worker"] ?? [],
					joinedAt: u["createdAt"],
				})
			);
		}
	});
}

/** Resolve the system role id for the org owner (used on first membership). */
export async function getOwnerRoleId(orgId: string): Promise<string | null> {
	return withActionError("getOwnerRoleId", async () => {
		try {
			const role = await withRetry(() =>
				db["organizationRole"]["findFirst"]({
					where: { orgId, isSystem: true, name: "Owner" },
					select: { id: true },
				})
			);
			return role?.["id"] ?? null;
		} catch (err) {
			if (isMissingColumnError(err)) return null;
			throw err;
		}
	});
}

/**
 * Look up the membership row for a user in an org (including their role +
 * permissions). Returns null when the membership model is not yet migrated.
 */
export async function getMembership(userId: string, orgId: string): Promise<MembershipRow | null> {
	return withActionError("getMembership", async () => {
		try {
			const m = await withRetry(() =>
				db["organizationMembership"]["findUnique"]({
					where: { orgId_userId: { orgId, userId } },
					include: {
						role: { include: { permissions: { select: { permission: true } } } },
					},
				})
			);
			if (!m) return null;
			return toMembershipRow(m);
		} catch (err) {
			if (!isMissingColumnError(err)) throw err;
			return null;
		}
	});
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export interface UpdateMemberRoleInput {
	orgId: string;
	userId: string;
	roleId: string;
}

/**
 * Reassign a team member to a different role. Only members with
 * `team.invite` may change another member's role; nobody can remove themselves.
 */
export async function updateMemberRole(input: UpdateMemberRoleInput) {
	return withActionError("updateMemberRole", async () => {
		const actor = await requireUser();
		if (!actor["organizationId"]) actionError("No organization");
		if (actor["organizationId"] !== input["orgId"]) actionError("Not a member of this organisation");

		const decision = await authorize({
			userId: actor["id"],
			orgId: input["orgId"],
			permission: "team.invite",
		});
		if (!decision["allowed"]) actionError(decision["reason"]);

		if (input["userId"] === actor["id"]) actionError("You cannot change your own role.");

		try {
			await withRetry(() =>
				db["organizationMembership"]["update"]({
					where: { orgId_userId: { orgId: input["orgId"], userId: input["userId"] } },
					data: { roleId: input["roleId"] },
				})
			);
		} catch (err) {
			if (isMissingColumnError(err)) actionError("Role management tables are not available yet. Run migrations.");
			throw err;
		}

		await revalidateWithLocale("/dashboard/team");
		await recordAudit({
			category: "ADMIN",
			action: "ROLE_CHANGED",
			orgId: input["orgId"],
			actorId: actor["id"],
			actorEmail: actor["email"],
			targetType: "User",
			targetId: input["userId"],
			metadata: { roleId: input["roleId"] },
		});
	});
}

/** Remove a user from the organisation. */
export async function removeMember(input: { orgId: string; userId: string }) {
	return withActionError("removeMember", async () => {
		const actor = await requireUser();
		if (!actor["organizationId"]) actionError("No organization");
		if (actor["organizationId"] !== input["orgId"]) actionError("Not a member of this organisation");

		const decision = await authorize({
			userId: actor["id"],
			orgId: input["orgId"],
			permission: "team.remove",
		});
		if (!decision["allowed"]) actionError(decision["reason"]);

		if (input["userId"] === actor["id"]) actionError("You cannot remove yourself.");

		try {
			await withRetry(() =>
				db["organizationMembership"]["deleteMany"]({
					where: { orgId: input["orgId"], userId: input["userId"] },
				})
			);
			await withRetry(() =>
				db["user"]["update"]({
					where: { id: input["userId"] },
					data: { organizationId: null },
				})
			);
		} catch (err) {
			if (isMissingColumnError(err)) actionError("Membership tables are not available yet. Run migrations.");
			throw err;
		}

		revalidatePath("/dashboard/team");
		await recordAudit({
			category: "ADMIN",
			action: "MEMBER_REMOVED",
			orgId: input["orgId"],
			actorId: actor["id"],
			actorEmail: actor["email"],
			targetType: "User",
			targetId: input["userId"],
		});
	});
}
