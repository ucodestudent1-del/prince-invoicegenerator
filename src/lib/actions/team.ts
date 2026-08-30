"use server";

import { requireUser, isMissingColumnError } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/action-rate-limit";

export interface InviteTeamMemberInput {
  email: string;
  name: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
}

export async function inviteTeamMember(input: InviteTeamMemberInput) {
  return withActionError("inviteTeamMember", async () => {
    const user = await requireUser();
    if (!user.organizationId) {
      actionError("No organization");
    }
    const orgId = user.organizationId;

    if (!checkRateLimit(`team-invite:${user.email}`, 10, 60 * 60 * 1000)) {
      actionError("Too many team invitations. Please try again later.");
    }

    const normalizedEmail = input.email.toLowerCase().trim();

    if (!normalizedEmail) {
      actionError("Email is required.");
    }

    const existingUser = await db["user"]["findUnique"]({
      where: { email: normalizedEmail },
      select: { id: true, organizationId: true },
    });

    if (existingUser) {
      if (existingUser.organizationId === orgId) {
        actionError("This user is already a member of your organization.");
      }
      actionError(
        "An account with this email already exists. Ask them to contact their current org admin."
      );
    }

    const tempPassword = randomBytes(16).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    try {
      await db["user"]["create"]({
        data: {
          email: normalizedEmail,
          name: input.name.trim(),
          password: hashedPassword,
          organizationId: orgId,
          role: input.role,
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        actionError(
          "Database schema is out of date. Please run migrations and try again."
        );
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
      } else {
        throw err;
      }
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await sendEmail({
      to: normalizedEmail,
      subject: `You've been invited to join an organization`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Invitation to join organization</h2>
          <p>${
            input.name.trim() || "Someone"
          } has invited you to join their organization on Prince.</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Set Your Password</a>
          <p style="color: #6b7280; font-size: 14px;">Click the button above to set your password and access your account. This link expires in 7 days.</p>
        </div>
      `,
      text: `You've been invited to join an organization. Set your password at ${resetUrl}\n\nThis link expires in 7 days.`,
    });

    revalidatePath("/dashboard/team");

    return { success: true, email: normalizedEmail };
  });
}
