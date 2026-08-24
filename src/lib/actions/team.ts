"use server";

import { requireUser, isMissingColumnError } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

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

    const normalizedEmail = input.email.toLowerCase().trim();

    if (!normalizedEmail) {
      actionError("Email is required.");
    }

    const existingUser = await db.user.findUnique({
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
      await db.user.create({
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

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const loginUrl = `${baseUrl}/login`;

    await sendEmail({
      to: normalizedEmail,
      subject: `You've been invited to join an organization`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Invitation to join organization</h2>
          <p>${
            input.name.trim() || "Someone"
          } has invited you to join their organization on Prince.</p>
          <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Sign In</a>
          <p style="color: #6b7280; font-size: 14px;">Your temporary password is: <strong>${tempPassword}</strong> (use it on first sign-in)</p>
          </div>
      `,
      text: `You've been invited to join an organization. Sign in at ${loginUrl} with your email and password: ${tempPassword}`,
    });

    revalidatePath("/dashboard/team");

    return { success: true, email: normalizedEmail };
  });
}
