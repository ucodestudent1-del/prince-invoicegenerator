"use server";

import { db } from "@/lib/db";
import { withActionError, actionError } from "@/lib/action-errors";
import { sendEmail } from "@/lib/email";
import { randomBytes } from "crypto";

const SESSION_DURATION_DAYS = 7;
const MAGIC_LINK_EXPIRY_MINUTES = 15;

export async function requestPortalAccess(email: string) {
  return withActionError("requestPortalAccess", async () => {
    if (!email || email.trim() === "") {
      actionError("Email address is required.");
    }

    const customer = await db.customer.findFirst({
      where: { email: email.trim() },
      include: { org: { select: { name: true } } },
    });

    if (!customer) {
      // Don't reveal whether email exists
      return { success: true, message: "If an account exists, a login link has been sent." };
    }

    if (!customer.portalAccess) {
      return { success: true, message: "If an account exists, a login link has been sent." };
    }

    // Generate magic link token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

    await db.portalSession.create({
      data: {
        customerId: customer.id,
        token,
        expiresAt,
      },
    });

    // Build magic link URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.princeinvoice.com";
    const magicLink = `${baseUrl}/portal/auth/verify?token=${token}`;

    // Send email with magic link
    await sendEmail({
      to: email,
      subject: `Sign in to ${customer.org?.name || "your account"}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Sign in to your account</h2>
          <p>Click the button below to securely sign in to your customer portal. This link expires in ${MAGIC_LINK_EXPIRY_MINUTES} minutes.</p>
          <a href="${magicLink}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Sign In</a>
          <p style="color: #6b7280; font-size: 14px;">If you didn't request this link, you can safely ignore this email.</p>
        </div>
      `,
      text: `Sign in to your account: ${magicLink}\n\nThis link expires in ${MAGIC_LINK_EXPIRY_MINUTES} minutes.`,
    });

    return { success: true, message: "If an account exists, a login link has been sent." };
  });
}

export async function verifyPortalToken(token: string) {
  return withActionError("verifyPortalToken", async () => {
    if (!token) actionError("Invalid token");

    const session = await db.portalSession.findUnique({
      where: { token },
      include: { customer: true },
    });

    if (!session) actionError("Invalid or expired token");
    if (session.revokedAt) actionError("Token has been revoked");
    if (session.expiresAt < new Date()) actionError("Token has expired");

    // Create a new long-lived session
    const newToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const newSession = await db.portalSession.create({
      data: {
        customerId: session.customerId,
        token: newToken,
        expiresAt,
        ipAddress: null,
        userAgent: null,
      },
    });

    // Revoke the magic link token
    await db.portalSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return {
      token: newSession.token,
      customer: {
        id: session.customer.id,
        name: session.customer.name,
        email: session.customer.email,
      },
    };
  });
}

export async function getPortalSession(token: string) {
  return withActionError("getPortalSession", async () => {
    if (!token) return null;

    const session = await db.portalSession.findUnique({
      where: { token },
      include: { customer: { include: { org: { select: { name: true, brandColor: true } } } } },
    });

    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;

    // Update last accessed
    await db.portalSession.update({
      where: { id: session.id },
      data: { lastAccessedAt: new Date() },
    });

    return session;
  });
}

export async function revokePortalSession(token: string) {
  return withActionError("revokePortalSession", async () => {
    await db.portalSession.updateMany({
      where: { token },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  });
}

export async function getPortalDashboard(token: string) {
  return withActionError("getPortalDashboard", async () => {
    const session = await getPortalSession(token);
    if (!session) actionError("Unauthorized");

    const customer = session.customer;

    const [invoices, payments] = await Promise.all([
      db.invoice.findMany({
        where: { customerId: customer.id },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          amountPaid: true,
          issueDate: true,
          dueDate: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.payment.findMany({
        where: { invoice: { customerId: customer.id } },
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          createdAt: true,
          invoice: { select: { number: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        outstandingBalance: customer.outstandingBalance,
        totalInvoiced: customer.totalInvoiced,
        totalPaid: customer.totalPaid,
      },
      invoices,
      payments,
    };
  });
}

export async function updatePortalProfile(
  token: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    website?: string;
    taxId?: string;
  }
) {
  return withActionError("updatePortalProfile", async () => {
    const session = await getPortalSession(token);
    if (!session) actionError("Unauthorized");

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.taxId !== undefined) updateData.taxId = data.taxId;

    const customer = await db.customer.update({
      where: { id: session.customer.id },
      data: updateData,
    });

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      website: customer.website,
      taxId: customer.taxId,
    };
  });
}
