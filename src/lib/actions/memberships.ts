"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidatePath } from "next/cache";
import { revalidateWithLocale } from "@/lib/revalidate";
import { recordAudit } from "@/lib/audit";
import { withRetry, isMissingColumnError, isDriftError, isMissingTableError, isInvalidEnumValueError } from "@/lib/db-drift";
import { SYSTEM_ROLES, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import type { SystemRoleId, Permission } from "@/lib/permissions";
import { authorize } from "@/lib/authorization";
import { checkRateLimit } from "@/lib/action-rate-limit";
import { sendEmail } from "@/lib/email";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

export type AccountStatus = "active" | "invited" | "inactive" | "deactivated";
export type InvitationStatus = "accepted" | "pending" | "expired" | "not_invited";

export interface MemberProject {
	id: string;
	name: string;
}

export interface MembershipRow {
	id: string;
	userId: string;
	name: string | null;
	email: string | null;
	image: string | null;
	jobTitle: string | null;
	roleId: string | null;
	roleName: string | null;
	isSystem: boolean;
	permissions: Permission[];
	joinedAt: Date;
	accountStatus: AccountStatus;
	invitationStatus: InvitationStatus;
	assignedProjects: MemberProject[];
	lastActivity: Date | null;
	emailVerified: Date | null;
}

export interface ProjectRow {
	id: string;
	name: string;
}

// ---------------------------------------------------------------------------
// Seeding / migration helpers
// ---------------------------------------------------------------------------

const LEGACY_ROLE_TO_SYSTEM_ID: Record<string, SystemRoleId> = {
	OWNER: "owner",
	ADMIN: "administrator",
	MEMBER: "project_manager",
	VIEWER: "viewer",
};

function legacyRoleToSystemId(role: string): SystemRoleId | null {
	return LEGACY_ROLE_TO_SYSTEM_ID[role] ?? null;
}

/**
 * Seed the immutable system roles (and their permissions) for an organisation.
 * Safe to call repeatedly. Degrades gracefully when the new tables are absent
 * (schema drift), returning false.
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

/**
 * Compute derived account + invitation status for a membership row.
 *
 * - `invited` (no acceptedAt) + not verified → pending
 * - invited + accepted (emailVerified) → accepted
 * - invited + expired token → expired
 * - deactivated (isActive=false) → deactivated
 * - otherwise → active / not_invited
 */
function deriveStatuses(m: any): { account: AccountStatus; invitation: InvitationStatus } {
	const isInvited = m["invitedAt"] != null || m["invitationAcceptedAt"] != null || !!m["user"]?.["emailVerified"];
	const isActive = m["isActive"] ?? true;
	const accepted = m["invitationAcceptedAt"] != null || !!m["user"]?.["emailVerified"];

	if (!isActive) return { account: "deactivated", invitation: accepted ? "accepted" : "pending" };
	if (isInvited && !accepted) return { account: "invited", invitation: "pending" };
	if (isInvited && accepted) return { account: "active", invitation: "accepted" };
	return { account: "active", invitation: "not_invited" };
}

function toMembershipRow(m: any): MembershipRow {
	const user = m["user"] ?? {};
	const perms: Permission[] = m["role"]?.["permissions"]?.["map"]((p: any) => p["permission"] as Permission) ?? [];
	const legacyFallback = DEFAULT_ROLE_PERMISSIONS[legacyRoleToSystemId(user["role"] as any) ?? "viewer"] ?? [];
	const status = deriveStatuses(m);

	return {
		id: m["id"],
		userId: m["userId"],
		name: user["name"] ?? null,
		email: user["email"] ?? null,
		image: user["image"] ?? null,
		jobTitle: m["jobTitle"] ?? user["jobTitle"] ?? null,
		roleId: m["roleId"] ?? null,
		roleName: m["role"]?.["name"] ?? user["role"] ?? null,
		isSystem: m["role"]?.["isSystem"] ?? true,
		permissions: perms["length"] > 0 ? perms : legacyFallback,
		joinedAt: m["createdAt"] ?? user["createdAt"] ?? new Date(),
		accountStatus: status["account"],
		invitationStatus: status["invitation"],
		assignedProjects: (m["assignedProjects"] ?? []).map((p: any) => ({
			id: p["id"],
			name: p["name"],
		})),
		lastActivity: m["lastActivity"] ?? null,
		emailVerified: user["emailVerified"] ?? null,
	};
}

/** List every project in the organisation (id + name only). */
export async function listProjectsForOrg(orgId: string): Promise<ProjectRow[]> {
	return withActionError("listProjectsForOrg", async () => {
		try {
			return await withRetry(() =>
				db["project"]["findMany"]({
					where: { orgId },
					select: { id: true, name: true },
					orderBy: { name: "asc" },
				})
			);
		} catch (err) {
			if (isMissingColumnError(err)) return [];
			throw err;
		}
	});
}

/** List every member of the organisation with their resolved role + perms. */
export async function listMemberships(orgId: string): Promise<MembershipRow[]> {
	return withActionError("listMemberships", async () => {
		try {
			const rows = await withRetry(() =>
				db["organizationMembership"]["findMany"]({
					where: { orgId },
					include: {
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								image: true,
								emailVerified: true,
								jobTitle: true,
								createdAt: true,
							},
						},
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
					select: {
						id: true,
						name: true,
						email: true,
						image: true,
						role: true,
						jobTitle: true,
						emailVerified: true,
						createdAt: true,
					},
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
					jobTitle: u["jobTitle"] ?? null,
					roleId: null,
					roleName: u["role"],
					isSystem: true,
					permissions:
						DEFAULT_ROLE_PERMISSIONS[legacyRoleToSystemId(u["role"] as any) ?? "viewer"] ?? [],
					joinedAt: u["createdAt"],
					accountStatus: u["emailVerified"] ? "active" : "invited",
					invitationStatus: u["emailVerified"] ? "accepted" : "pending",
					assignedProjects: [],
					lastActivity: null,
					emailVerified: u["emailVerified"] ?? null,
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
					where: { orgId, isSystem: true, name: "Company Owner" },
					select: { id: true },
				})
			);
			if (role) return role["id"];
			// Fallback for legacy DBs where the role name is "Owner".
			const fallback = await withRetry(() =>
				db["organizationRole"]["findFirst"]({
					where: { orgId, isSystem: true, name: "Owner" },
					select: { id: true },
				})
			);
			return fallback?.["id"] ?? null;
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
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								image: true,
								emailVerified: true,
								jobTitle: true,
								createdAt: true,
							},
						},
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

// ---------------------------------------------------------------------------
// Member activity / audit log
// ---------------------------------------------------------------------------

export interface UserActivityEntry {
	id: string;
	category: string;
	action: string;
	targetType: string | null;
	targetId: string | null;
	outcome: string;
	ip: string | null;
	userAgent: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: Date;
}

/**
 * Read recent audit entries related to a specific user (as actor or target).
 * Read-only by construction; does not mutate any data.
 */
export async function getUserActivity(
	userId: string,
	orgId: string,
	limit = 100
): Promise<UserActivityEntry[]> {
	return withActionError("getUserActivity", async () => {
		const actor = await requireUser();
		if (!actor["organizationId"]) actionError("No organization");
		if (actor["organizationId"] !== orgId) actionError("Not a member of this organisation");

		const decision = await authorize({
			userId: actor["id"],
			orgId,
			permission: "reports.view",
		});
		if (!decision["allowed"]) actionError(decision["reason"]);

		try {
			return await withRetry(() =>
				db["auditLog"]["findMany"]({
					where: {
						orgId,
						OR: [{ actorId: userId }, { targetId: userId }],
					},
					orderBy: { createdAt: "desc" },
					take: Math.max(Math.min(limit, 500), 1),
					select: {
						id: true,
						category: true,
						action: true,
						targetType: true,
						targetId: true,
						outcome: true,
						ip: true,
						userAgent: true,
						metadata: true,
						createdAt: true,
					},
				})
			) as UserActivityEntry[];
		} catch (err) {
			if (isMissingColumnError(err) || isMissingTableError(err)) return [];
			throw err;
		}
	});
}

// ---------------------------------------------------------------------------
// Member actions (directory operations)
// ---------------------------------------------------------------------------

export interface DeactivateMemberInput {
	orgId: string;
	userId: string;
}

/**
 * Deactivate a team member's account. The user remains in the organisation (so
 * their audit history is preserved) but can no longer sign in.
 * Requires team.invite (owners and admins).
 */
export async function deactivateMember(input: DeactivateMemberInput) {
	return withActionError("deactivateMember", async () => {
		const actor = await requireUser();
		if (!actor["organizationId"]) actionError("No organization");
		if (actor["organizationId"] !== input["orgId"]) actionError("Not a member of this organisation");

		const decision = await authorize({
			userId: actor["id"],
			orgId: input["orgId"],
			permission: "team.invite",
		});
		if (!decision["allowed"]) actionError(decision["reason"]);

		if (input["userId"] === actor["id"]) actionError("You cannot deactivate yourself.");

		try {
			await withRetry(() =>
				db["organizationMembership"]["updateMany"]({
					where: { orgId: input["orgId"], userId: input["userId"] },
					data: { isActive: false },
				})
			);
		} catch (err: any) {
			if (!isMissingColumnError(err)) throw err;
			// Column doesn't exist — fall back to setting a deactivated flag on the user
			await withRetry(() =>
				db["user"]["update"]({
					where: { id: input["userId"] },
					data: { emailVerified: null } as any,
				})
			).catch(() => {});
		}

		await revalidateWithLocale("/dashboard/team");
		await recordAudit({
			category: "ADMIN",
			action: "MEMBER_DEACTIVATED",
			orgId: input["orgId"],
			actorId: actor["id"],
			actorEmail: actor["email"],
			actorRole: actor["role"],
			targetType: "User",
			targetId: input["userId"],
		});

		return { success: true };
	});
}

export interface ReactivateMemberInput {
	orgId: string;
	userId: string;
}

/** Reactivate a previously deactivated member. Requires team.invite. */
export async function reactivateMember(input: ReactivateMemberInput) {
	return withActionError("reactivateMember", async () => {
		const actor = await requireUser();
		if (!actor["organizationId"]) actionError("No organization");
		if (actor["organizationId"] !== input["orgId"]) actionError("Not a member of this organisation");

		const decision = await authorize({
			userId: actor["id"],
			orgId: input["orgId"],
			permission: "team.invite",
		});
		if (!decision["allowed"]) actionError(decision["reason"]);

		try {
			await withRetry(() =>
				db["organizationMembership"]["updateMany"]({
					where: { orgId: input["orgId"], userId: input["userId"] },
					data: { isActive: true },
				})
			);
		} catch (err: any) {
			if (!isMissingColumnError(err)) throw err;
		}

		await revalidateWithLocale("/dashboard/team");
		await recordAudit({
			category: "ADMIN",
			action: "MEMBER_REACTIVATED",
			orgId: input["orgId"],
			actorId: actor["id"],
			actorEmail: actor["email"],
			actorRole: actor["role"],
			targetType: "User",
			targetId: input["userId"],
		});

		return { success: true };
	});
}

export interface ResendInvitationInput {
	orgId: string;
	userId: string;
}

/**
 * Re-send the password-setup email to an invited (not-yet-accepted) user.
 * Requires team.invite.
 */
export async function resendInvitation(input: ResendInvitationInput) {
	return withActionError("resendInvitation", async () => {
		const actor = await requireUser();
		if (!actor["organizationId"]) actionError("No organization");
		if (actor["organizationId"] !== input["orgId"]) actionError("Not a member of this organisation");

		const decision = await authorize({
			userId: actor["id"],
			orgId: input["orgId"],
			permission: "team.invite",
		});
		if (!decision["allowed"]) actionError(decision["reason"]);

		if (!(await checkRateLimit(`team-invite:${actor["email"]}`, 10, 60 * 60 * 1000))) {
			actionError("Too many invitations. Please try again later.");
		}

		// Fetch the target user (who was pre-created during invite)
		const target = await withRetry(() =>
			db["user"]["findUnique"]({
				where: { id: input["userId"] },
				select: { email: true, name: true, organizationId: true, emailVerified: true },
			})
		);
		if (!target || target["organizationId"] !== input["orgId"]) {
			return { success: false, error: "User not found." };
		}
		if (target["emailVerified"]) {
			return { success: false, error: "This user has already accepted their invitation." };
		}

		const email = target["email"]!;
		const token = randomBytes(32).toString("hex");
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

		try {
			await db["verificationToken"]["create"]({
				data: {
					identifier: email,
					token,
					expires: expiresAt,
					type: "PASSWORD_RESET",
				},
			});
		} catch (err: any) {
			if (isInvalidEnumValueError(err)) {
				await db["verificationToken"]["create"]({
					data: { identifier: email, token, expires: expiresAt },
				});
			} else {
				throw err;
			}
		}

		const baseUrl =
			process.env["NEXT_PUBLIC_BASE_URL"] || process.env["NEXTAUTH_URL"] || "http://localhost:3000";
		const resetUrl = `${baseUrl}/reset-password?token=${token}`;

		await sendEmail({
			to: email,
			subject: `You've been invited to join an organization`,
			html: `
				<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
					<h2>Invitation to join organization</h2>
					<p>${target["name"] || "Someone"} has invited you to join their organization on Prince.</p>
					<a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Set Your Password</a>
					<p style="color: #6b7280; font-size: 14px;">Click the button above to set your password and access your account. This link expires in 7 days.</p>
				</div>
			`,
			text: `You've been invited to join an organization. Set your password at ${resetUrl}\n\nThis link expires in 7 days.`,
		});

		await recordAudit({
			category: "ADMIN",
			action: "INVITATION_RESENT",
			orgId: input["orgId"],
			actorId: actor["id"],
			actorEmail: actor["email"],
			actorRole: actor["role"],
			targetType: "User",
			targetId: input["userId"],
			metadata: { invitedEmail: email },
		});

		return { success: true, email };
	});
}

export interface AssignProjectsInput {
	orgId: string;
	userId: string;
	projectIds: string[];
}

/**
 * Assign (or replace) a user's project assignments. Requires team.invite.
 */
export async function assignProjects(input: AssignProjectsInput) {
	return withActionError("assignProjects", async () => {
		const actor = await requireUser();
		if (!actor["organizationId"]) actionError("No organization");
		if (actor["organizationId"] !== input["orgId"]) actionError("Not a member of this organisation");

		const decision = await authorize({
			userId: actor["id"],
			orgId: input["orgId"],
			permission: "team.invite",
		});
		if (!decision["allowed"]) actionError(decision["reason"]);

		if (input["userId"] === actor["id"]) actionError("You cannot reassign your own projects.");

		// Validate that all projects belong to this org
		const projectCount = await withRetry(() =>
			db["project"]["count"]({
				where: { orgId: input["orgId"], id: { in: input["projectIds"] } },
			})
		);
		if (projectCount !== input["projectIds"]["length"]) {
			actionError("One or more selected projects do not belong to this organization.");
		}

		// Replace existing project assignments for this user
		await db["$transaction"](async (tx) => {
			await tx["projectMember"]["deleteMany"]({
				where: { orgId: input["orgId"], userId: input["userId"] },
			});
			for (const projectId of input["projectIds"]) {
				try {
					await tx["projectMember"]["create"]({
						data: {
							orgId: input["orgId"],
							projectId,
							userId: input["userId"],
						},
					});
				} catch (err: any) {
					// Skip if a project member row already exists for this user+project
					if (err["code"] !== "P2002") throw err;
				}
			}
		});

		await revalidateWithLocale("/dashboard/team");
		await recordAudit({
			category: "ADMIN",
			action: "PROJECTS_ASSIGNED",
			orgId: input["orgId"],
			actorId: actor["id"],
			actorEmail: actor["email"],
			actorRole: actor["role"],
			targetType: "User",
			targetId: input["userId"],
			metadata: { projectIds: input["projectIds"] },
		});

		return { success: true };
	});
}

export interface UpdateJobTitleInput {
	orgId: string;
	userId: string;
	jobTitle: string | null;
}

/**
 * Update a team member's job title (distinct from their system role).
 * Requires team.invite.
 */
export async function updateMemberJobTitle(input: UpdateJobTitleInput) {
	return withActionError("updateMemberJobTitle", async () => {
		const actor = await requireUser();
		if (!actor["organizationId"]) actionError("No organization");
		if (actor["organizationId"] !== input["orgId"]) actionError("Not a member of this organisation");

		const decision = await authorize({
			userId: actor["id"],
			orgId: input["orgId"],
			permission: "team.invite",
		});
		if (!decision["allowed"]) actionError(decision["reason"]);

		try {
			await withRetry(() =>
				db["organizationMembership"]["updateMany"]({
					where: { orgId: input["orgId"], userId: input["userId"] },
					data: { jobTitle: input["jobTitle"] ?? undefined },
				})
			);
		} catch (err: any) {
			if (!isMissingColumnError(err)) throw err;
			// Column doesn't exist — try updating the User.jobTitle fallback
			await withRetry(() =>
				db["user"]["update"]({
					where: { id: input["userId"] },
					data: { jobTitle: input["jobTitle"] ?? undefined } as any,
				})
			).catch(() => {});
		}

		await revalidateWithLocale("/dashboard/team");
		await recordAudit({
			category: "ADMIN",
			action: "JOB_TITLE_CHANGED",
			orgId: input["orgId"],
			actorId: actor["id"],
			actorEmail: actor["email"],
			actorRole: actor["role"],
			targetType: "User",
			targetId: input["userId"],
			metadata: { jobTitle: input["jobTitle"] },
		});

		return { success: true };
	});
}
