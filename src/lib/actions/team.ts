"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { isMissingColumnError, isInvalidEnumValueError } from "@/lib/db-drift";
import { withActionError, actionError } from "@/lib/action-errors";
import { sendEmail } from "@/lib/email";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "@/lib/action-rate-limit";
import { recordAudit } from "@/lib/audit";
import { authorize } from "@/lib/authorization";
import { SYSTEM_ROLES } from "@/lib/permissions";
import type { SystemRoleId } from "@/lib/permissions";
import { revalidateWithLocale } from "@/lib/revalidate";

/** Map legacy OrgRole enum values to system role ids (for backward compat). */
const LEGACY_TO_SYSTEM: Record<string, SystemRoleId> = {
	OWNER: "owner",
	ADMIN: "administrator",
	MEMBER: "project_manager",
	VIEWER: "viewer",
};

export interface InviteTeamMemberInput {
	email: string;
	name: string;
	roleId: SystemRoleId;
	jobTitle?: string | null;
}

export async function inviteTeamMember(input: InviteTeamMemberInput) {
	return withActionError("inviteTeamMember", async () => {
		const user = await requireUser();
		if (!user["organizationId"]) {
			return { success: false, error: "No organization" };
		}
		const orgId = user["organizationId"];

		// Permission gate: only members with team.invite may invite others.
		const decision = await authorize({
			userId: user["id"],
			orgId,
			permission: "team.invite",
		});
		if (!decision["allowed"]) {
			return { success: false, error: decision["reason"] };
		}

		if (!(await checkRateLimit(`team-invite:${user["email"]}`, 10, 60 * 60 * 1000))) {
			return { success: false, error: "Too many team invitations. Please try again later." };
		}

		const normalizedEmail = input["email"]["toLowerCase"]().trim();

		if (!normalizedEmail) {
			return { success: false, error: "Email is required." };
		}

		// Validate that the roleId is a known system role.
		const systemRole = SYSTEM_ROLES["find"]((r) => r["id"] === input["roleId"]);
		if (!systemRole) {
			return { success: false, error: `Invalid role: ${input["roleId"]}` };
		}

		const existingUser = await db["user"]["findUnique"]({
			where: { email: normalizedEmail },
			select: { id: true, organizationId: true },
		});

		if (existingUser) {
			if (existingUser["organizationId"] === orgId) {
				return { success: false, error: "This user is already a member of your organization." };
			}
			return { success: false, error: "An account with this email already exists. Ask them to contact their current org admin." };
		}

		const tempPassword = randomBytes(16).toString("hex");
		const hashedPassword = await bcrypt["hash"](tempPassword, 12);

		let invitedUserId: string | undefined;
		let legacyRole: string;
		// Map the system role id back to the legacy OrgRole enum for backward
		// compatibility with code that still reads User.role.
		const inverseMap: Record<SystemRoleId, string> = {
			owner: "OWNER",
			administrator: "ADMIN",
			project_manager: "MEMBER",
			viewer: "VIEWER",
		} as Record<string, string>;
		legacyRole = inverseMap[input["roleId"]] ?? "MEMBER";

		try {
			const created = await db["user"]["create"]({
				data: {
					email: normalizedEmail,
					name: input["name"]["trim"](),
					password: hashedPassword,
					organizationId: orgId,
					role: legacyRole as any,
					jobTitle: input["jobTitle"]?.trim() ?? null,
				},
				select: { id: true },
			});
			invitedUserId = created["id"];

			// Create an OrganizationMembership row linking the user to the
			// chosen system role. Best-effort: skip if the table is absent.
			try {
				await db["organizationMembership"]["create"]({
					data: {
						orgId,
						userId: created["id"],
						roleId: input["roleId"],
						jobTitle: input["jobTitle"]?.trim() ?? null,
						invitedById: user["id"],
						invitedAt: new Date(),
						isActive: true,
					},
				});
			} catch (membershipErr: any) {
				if (!isMissingColumnError(membershipErr)) throw membershipErr;
			}
		} catch (err) {
			if (isMissingColumnError(err)) {
				return {
					success: false,
					error: "Database schema is out of date. Please run migrations and try again.",
				};
			}
			throw err;
		}

		const token = randomBytes(32).toString("hex");
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

		try {
			await db["verificationToken"]["create"]({
				data: {
					identifier: normalizedEmail,
					token,
					expires: expiresAt,
					type: "PASSWORD_RESET",
				},
			});
		} catch (err) {
			if (isMissingColumnError(err)) {
				await db["verificationToken"]["create"]({
					data: {
						identifier: normalizedEmail,
						token,
						expires: expiresAt,
					},
				});
			} else if (isInvalidEnumValueError(err)) {
				await db["verificationToken"]["create"]({
					data: {
						identifier: normalizedEmail,
						token,
						expires: expiresAt,
					},
				});
			} else {
				throw err;
			}
		}

		const baseUrl =
			process.env["NEXT_PUBLIC_BASE_URL"] || process.env["NEXTAUTH_URL"] || "http://localhost:3000";
		const resetUrl = `${baseUrl}/reset-password?token=${token}`;

		await sendEmail({
			to: normalizedEmail,
			subject: `You've been invited to join an organization`,
			html: `
				<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
					<h2>Invitation to join organization</h2>
					<p>${
						input["name"]["trim"] || "Someone"
					} has invited you to join their organization on Prince.</p>
					<p>You have been assigned the <strong>${systemRole["name"]}</strong> role.</p>
					<a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Set Your Password</a>
					<p style="color: #6b7280; font-size: 14px;">Click the button above to set your password and access your account. This link expires in 7 days.</p>
				</div>
			`,
			text: `You've been invited to join an organization as ${systemRole["name"]}. Set your password at ${resetUrl}\n\nThis link expires in 7 days.`,
		});

		await revalidateWithLocale("/dashboard/team");

		await recordAudit({
			category: "ADMIN",
			action: "USER_INVITED",
			orgId,
			actorId: user["id"],
			actorEmail: user["email"],
			actorRole: user["role"],
			targetType: "User",
			targetId: invitedUserId,
			metadata: { invitedEmail: normalizedEmail, roleId: input["roleId"], jobTitle: input["jobTitle"] ?? null },
		});

		return { success: true, email: normalizedEmail };
	});
}
