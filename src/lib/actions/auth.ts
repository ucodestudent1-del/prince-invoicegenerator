"use server";

import { withActionError, actionError } from "@/lib/action-errors";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { checkRateLimit } from "@/lib/action-rate-limit";

const VERIFICATION_TOKEN_EXPIRY_MINUTES = 24 * 60;
const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;
const MAGIC_LINK_EXPIRY_MINUTES = 15;
const MAGIC_LINK_RATE_LIMIT_PER_HOUR = 5;

function isValidPassword(password: string): boolean {
  if (!password || password.length < 8) return false;
  if (password.length > 128) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

export async function signup(data: {
  email: string;
  password: string;
  name: string;
  terms: boolean;
  marketing?: boolean;
}) {
  return withActionError("signup", async () => {
    if (!data.terms) {
      actionError("You must accept the terms and conditions.");
    }

    const normalizedEmail = data.email.toLowerCase().trim();

    if (!checkRateLimit(`signup:${normalizedEmail}`, 5, 60 * 60 * 1000)) {
      actionError("Too many signup attempts. Please try again later.");
    }

    if (!isValidPassword(data.password)) {
      actionError("Password must be at least 8 characters with uppercase, lowercase, number, and symbol.");
    }

    const existing = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      actionError("An account with this email already exists.");
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        name: data.name.trim(),
        password: hashedPassword,
      },
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + VERIFICATION_TOKEN_EXPIRY_MINUTES * 60 * 1000
    );

    await db.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token,
        expires: expiresAt,
        type: "EMAIL_VERIFY",
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    await sendEmail({
      to: normalizedEmail,
      subject: `Verify your email for ${process.env.APP_NAME || "Prince"}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Verify your email address</h2>
          <p>Click the button below to verify your email address. This link expires in 24 hours.</p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Verify Email</a>
          <p style="color: #6b7280; font-size: 14px;">If you didn&apos;t create an account, you can safely ignore this email.</p>
        </div>
      `,
      text: `Verify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    });

    return { success: true, userId: user.id };
  });
}

export async function verifyEmail(token: string) {
  return withActionError("verifyEmail", async () => {
    if (!token) {
      actionError("Invalid token");
    }

    if (!checkRateLimit(`verify-email:${token.slice(0, 8)}`, 10, 60 * 1000)) {
      actionError("Too many attempts. Please try again later.");
    }

    const record = await db.verificationToken.findUnique({
      where: { token },
    });

    if (!record || record.type !== "EMAIL_VERIFY") {
      actionError("Invalid or expired token");
    }

    if (record.expires < new Date()) {
      await db.verificationToken.delete({ where: { token } });
      actionError("Token has expired. Please request a new one.");
    }

    const user = await db.user.findUnique({
      where: { email: record.identifier },
    });

    if (!user) {
      actionError("User not found");
    }

    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });

    await db.verificationToken.delete({ where: { token } });

    return { success: true };
  });
}

export async function requestPasswordReset(email: string) {
  return withActionError("requestPasswordReset", async () => {
    const normalizedEmail = email.toLowerCase().trim();

    if (!checkRateLimit(`password-reset:${normalizedEmail}`, 3, 60 * 60 * 1000)) {
      actionError("Too many password reset requests. Please try again later.");
    }

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.password) {
      return { success: true };
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token,
        expires: expiresAt,
        type: "PASSWORD_RESET",
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await sendEmail({
      to: normalizedEmail,
      subject: `Reset your password for ${process.env.APP_NAME || "Prince"}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Reset your password</h2>
          <p>Click the button below to reset your password. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Reset Password</a>
          <p style="color: #6b7280; font-size: 14px;">If you didn&apos;t request a password reset, you can safely ignore this email.</p>
        </div>
      `,
      text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
    });

    return { success: true };
  });
}

export async function resetPassword(token: string, newPassword: string) {
  return withActionError("resetPassword", async () => {
    if (!token) {
      actionError("Invalid token");
    }

    if (!checkRateLimit(`reset-password:${token.slice(0, 8)}`, 10, 60 * 1000)) {
      actionError("Too many attempts. Please try again later.");
    }

    const record = await db.verificationToken.findUnique({
      where: { token },
    });

    if (!record || record.type !== "PASSWORD_RESET") {
      actionError("Invalid or expired token");
    }

    if (record.expires < new Date()) {
      await db.verificationToken.delete({ where: { token } });
      actionError("Token has expired. Please request a new one.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await db.user.update({
      where: { email: record.identifier },
      data: { password: hashedPassword },
    });

    await db.verificationToken.delete({ where: { token } });

    return { success: true };
  });
}

export async function resendVerificationEmail() {
  return withActionError("resendVerificationEmail", async () => {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      actionError("You must be logged in to resend verification.");
    }

    if (!checkRateLimit(`verify-email:${session.user.email}`, 3, 60 * 60 * 1000)) {
      actionError("Too many verification requests. Please try again later.");
    }

    const existingToken = await db.verificationToken.findFirst({
      where: { identifier: session.user.email },
      orderBy: { expires: "desc" },
    });

    if (existingToken && existingToken.expires > new Date(Date.now() + VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000)) {
      actionError("Please wait before requesting another email.");
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + VERIFICATION_TOKEN_EXPIRY_MINUTES * 60 * 1000
    );

    await db.verificationToken.create({
      data: {
        identifier: session.user.email,
        token,
        expires: expiresAt,
        type: "EMAIL_VERIFY",
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    await sendEmail({
      to: session.user.email,
      subject: `Verify your email for ${process.env.APP_NAME || "Prince"}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Verify your email address</h2>
          <p>Click the button below to verify your email address. This link expires in 24 hours.</p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Verify Email</a>
          <p style="color: #6b7280; font-size: 14px;">If you didn&apos;t create an account, you can safely ignore this email.</p>
        </div>
      `,
      text: `Verify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    });

    return { success: true };
  });
}

export async function requestMagicLink(email: string) {
  return withActionError("requestMagicLink", async () => {
    const normalizedEmail = email.toLowerCase().trim();

    if (!checkRateLimit(`magic-link:${normalizedEmail}`, 5, 60 * 60 * 1000)) {
      actionError("Too many magic link requests. Please try again later.");
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentLinks = await db.magicLink.count({
      where: {
        identifier: normalizedEmail,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentLinks >= MAGIC_LINK_RATE_LIMIT_PER_HOUR) {
      return { success: true };
    }

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { success: true };
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

    await db.magicLink.create({
      data: {
        identifier: normalizedEmail,
        token,
        expires: expiresAt,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const magicLinkUrl = `${baseUrl}/auth/magic-link?token=${token}`;

    await sendEmail({
      to: normalizedEmail,
      subject: `Sign in to ${process.env.APP_NAME || "Prince"}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Sign in to your account</h2>
          <p>Click the button below to sign in. This link expires in ${MAGIC_LINK_EXPIRY_MINUTES} minutes.</p>
          <a href="${magicLinkUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Sign In</a>
          <p style="color: #6b7280; font-size: 14px;">If you didn&apos;t request this link, you can safely ignore this email.</p>
        </div>
      `,
      text: `Sign in: ${magicLinkUrl}\n\nThis link expires in ${MAGIC_LINK_EXPIRY_MINUTES} minutes.`,
    });

    return { success: true };
  });
}

export async function verifyMagicLink(token: string) {
  return withActionError("verifyMagicLink", async () => {
    if (!token) {
      actionError("Invalid token");
    }

    const record = await db.magicLink.findUnique({
      where: { token },
    });

    if (!record) {
      actionError("Invalid or expired token");
    }

    if (record.expires < new Date()) {
      await db.magicLink.delete({ where: { token } });
      actionError("Token has expired. Please request a new one.");
    }

    return { success: true, email: record.identifier };
  });
}
