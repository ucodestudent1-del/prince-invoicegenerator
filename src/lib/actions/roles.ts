"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidateWithLocale } from "@/lib/revalidate";
import { withRetry, isMissingColumnError, isDriftError } from "@/lib/db-drift";
import { findInvalidPermissions, SYSTEM_ROLES, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import type { Permission, SystemRoleId } from "@/lib/permissions";
import { authorize } from "@/lib/authorization";
import { recordAudit } from "@/lib/audit";

export interface RoleRow {
	id: string;
	orgId: string | null;
	name: string;
	description: string | null;
	isSystem: boolean;
	isEditable: boolean;
	permissions: Permission[];
	memberCount: number;
	createdAt: Date;
	updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * List every role available to an organisation: the five immutable system
 * roles (permission sets managed in code) plus any custom roles the org has
 * created.
 */
export async function listRoles(orgId: string): Promise<RoleRow[]> {
	return withActionError("listRoles", async () => {
		const roles: RoleRow[] = [];

		// System roles come from the code-defined DEFAULT_ROLE_PERMISSIONS.
		for (const sr of SYSTEM_ROLES) {
			roles["push"]({
				id: sr["id"],
				orgId: null,
				name: sr["name"],
				description: sr["description"],
				isSystem: true,
				isEditable: false,
				permissions: DEFAULT_ROLE_PERMISSIONS[sr["id"] as SystemRoleId] ?? [],
				memberCount: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		// Custom roles from the DB.
		try {
			const custom = await withRetry(() =>
				db["organizationRole"]["findMany"]({
					where: { orgId, isSystem: false },
					include: {
						permissions: { select: { permission: true } },
						_count: { select: { memberships: true } },
					},
					orderBy: { createdAt: "asc" },
				})
			);
			for (const r of custom) {
				roles["push"]({
					id: r["id"],
					orgId: r["orgId"],
					name: r["name"],
					description: r["description"],
					isSystem: false,
					isEditable: r["isEditable"],
					permissions: r["permissions"]?.["map"]((p) => p["permission"] as Permission) ?? [],
					memberCount: r["_count"]?.["memberships"] ?? 0,
					createdAt: r["createdAt"],
					updatedAt: r["updatedAt"],
				});
			}
		} catch (err) {
			if (!isMissingColumnError(err)) throw err;
			// Tables not migrated yet — return system roles only.
		}

		return roles;
	});
}

/** Look up a single role by id (system or custom). */
export async function getRole(roleId: string, orgId: string): Promise<RoleRow | null> {
	return withActionError("getRole", async () => {
		const system = SYSTEM_ROLES["find"]((r) => r["id"] === roleId);
		if (system) {
			return {
				id: system["id"],
				orgId: null,
				name: system["name"],
				description: system["description"],
				isSystem: true,
				isEditable: false,
				permissions: DEFAULT_ROLE_PERMISSIONS[system["id"] as SystemRoleId] ?? [],
				memberCount: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
		}

		try {
			const r = await withRetry(() =>
				db["organizationRole"]["findFirst"]({
					where: { id: roleId, orgId: orgId },
					include: { permissions: { select: { permission: true } } },
				})
			);
			if (!r) return null;
			return {
				id: r["id"],
				orgId: r["orgId"],
				name: r["name"],
				description: r["description"],
				isSystem: r["isSystem"],
				isEditable: r["isEditable"],
				permissions: r["permissions"]?.["map"]((p) => p["permission"] as Permission) ?? [],
				memberCount: 0,
				createdAt: r["createdAt"],
				updatedAt: r["updatedAt"],
			};
		} catch (err) {
			if (isMissingColumnError(err)) return null;
			throw err;
		}
	});
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export interface CreateRoleInput {
	orgId: string;
	name: string;
	description?: string | null;
	permissions: string[];
}

/** Create a custom, editable role with an explicit permission set. */
export async function createRole(input: CreateRoleInput): Promise<RoleRow> {
	return withActionError("createRole", async () => {
		const actor = await requireUser();
		if (!actor["organizationId"]) actionError("No organization");
		if (actor["organizationId"] !== input["orgId"]) actionError("Not a member of this organisation");

		const decision = await authorize({
			userId: actor["id"],
			orgId: input["orgId"],
			permission: "settings.edit",
		});
		if (!decision["allowed"]) actionError(decision["reason"]);

		const invalid = findInvalidPermissions(input["permissions"]);
		if (invalid["length"] > 0) {
			actionError(`Unknown permissions: ${invalid["join"](", ")}`);
		}

		try {
			const r = await withRetry(() =>
				db["organizationRole"]["create"]({
					data: {
						orgId: input["orgId"],
						name: input["name"],
						description: input["description"],
						isSystem: false,
						isEditable: true,
						permissions: {
							create: input["permissions"]["map"]((p) => ({ permission: p })),
						},
					},
					include: { permissions: { select: { permission: true } } },
				})
			);
			return {
				id: r["id"],
				orgId: r["orgId"],
				name: r["name"],
				description: r["description"],
				isSystem: false,
				isEditable: true,
				permissions: r["permissions"]?.["map"]((p) => p["permission"] as Permission) ?? [],
				memberCount: 0,
				createdAt: r["createdAt"],
				updatedAt: r["updatedAt"],
			};
		} catch (err: any) {
			if (isMissingColumnError(err)) actionError("Role tables are not available yet. Run migrations.");
			if (err instanceof Error && err["message"]["includes"]("Unique constraint")) {
				actionError(`A role named "${input["name"]}" already exists.`);
			}
			throw err;
		}
	});
}

export interface UpdateRoleInput {
	roleId: string;
	permissions?: string[];
	name?: string;
	description?: string | null;
}

/** Update a custom role's name, description, and/or permission set. */
export async function updateRole(input: UpdateRoleInput): Promise<RoleRow> {
	return withActionError("updateRole", async () => {
		const actor = await requireUser();
		if (!actor["organizationId"]) actionError("No organization");

		const existing = await getRole(input["roleId"], actor["organizationId"]);
		if (!existing) actionError("Role not found");
		if (existing["isSystem"]) actionError("System roles cannot be modified");

		const decision = await authorize({
			userId: actor["id"],
			orgId: actor["organizationId"],
			permission: "settings.edit",
		});
		if (!decision["allowed"]) actionError(decision["reason"]);

		if (input["permissions"] !== undefined) {
			const invalid = findInvalidPermissions(input["permissions"]);
			if (invalid["length"] > 0) actionError(`Unknown permissions: ${invalid["join"](", ")}`);
		}

		try {
			const r = await withRetry(() =>
				db["organizationRole"]["update"]({
					where: { id: input["roleId"] },
					data: {
						...(input["name"] !== undefined && { name: input["name"] }),
						...(input["description"] !== undefined && { description: input["description"] }),
						...(input["permissions"] !== undefined && {
							permissions: {
								deleteMany: {},
								create: input["permissions"]["map"]((p: string) => ({ permission: p })),
							},
						}),
					},
					include: { permissions: { select: { permission: true } } },
				})
			);
			return {
				id: r["id"],
				orgId: r["orgId"],
				name: r["name"],
				description: r["description"],
				isSystem: r["isSystem"],
				isEditable: r["isEditable"],
				permissions: r["permissions"]?.["map"]((p) => p["permission"] as Permission) ?? [],
				memberCount: 0,
				createdAt: r["createdAt"],
				updatedAt: r["updatedAt"],
			};
		} catch (err: any) {
			if (isMissingColumnError(err)) actionError("Role tables are not available yet. Run migrations.");
			if (err instanceof Error && err["message"]["includes"]("Unique constraint")) {
				actionError(`A role named "${input["name"]}" already exists.`);
			}
			throw err;
		}
	});
}

/** Delete an unused custom role. System roles can never be deleted. */
export async function deleteRole(roleId: string): Promise<void> {
	return withActionError("deleteRole", async () => {
		const actor = await requireUser();
		if (!actor["organizationId"]) actionError("No organization");

		const decision = await authorize({
			userId: actor["id"],
			orgId: actor["organizationId"],
			permission: "settings.edit",
		});
		if (!decision["allowed"]) actionError(decision["reason"]);

		const existing = await getRole(roleId, actor["organizationId"]);
		if (!existing) actionError("Role not found");
		if (existing["isSystem"]) actionError("System roles cannot be deleted");
		if (existing["memberCount"] > 0) actionError("Cannot delete a role that is assigned to members");

		try {
			await withRetry(() =>
				db["organizationRole"]["delete"]({
					where: { id: roleId },
				})
			);
		} catch (err) {
			if (isMissingColumnError(err)) actionError("Role tables are not available yet. Run migrations.");
			throw err;
		}

		await revalidateWithLocale("/dashboard/team");
		await recordAudit({
			category: "ADMIN",
			action: "ROLE_DELETED",
			orgId: actor["organizationId"],
			actorId: actor["id"],
			actorEmail: actor["email"],
			targetType: "Role",
			targetId: roleId,
		});
	});
}
