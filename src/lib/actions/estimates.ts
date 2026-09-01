"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { isMissingColumnError } from "@/lib/db-drift";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidateWithLocale } from "@/lib/revalidate";
import { sendEmail, formatCurrency, formatDate } from "@/lib/email";
import { getNextInvoiceNumber } from "@/lib/numbering";
import type { EstimateStatus } from "@prisma/client";
import { randomUUID } from "crypto";

interface SendEstimateInput {
  ccEmails?: string[];
  message?: string;
  subjectOverride?: string;
}

interface ConvertEstimateInput {
  dueDate?: string | null;
  paymentTerms?: string;
  invoiceNumber?: string | null;
}

interface AcceptEstimateInput {
  token: string;
}

interface RejectEstimateInput {
  token: string;
  reason?: string;
}

interface ViewEstimateInput {
  token: string;
}

async function logEstimateAudit(
  estimateId: string,
  orgId: string,
  action: string,
  fromStatus: string | null,
  toStatus: string | null,
  note?: string,
  userId?: string | null
) {
  try {
    await db["estimateAudit"]["create"]({
      data: {
        orgId,
        estimateId,
        action,
        fromStatus,
        toStatus,
        note,
        createdById: userId ?? null,
      },
    });
  } catch (err) {
    if (isMissingColumnError(err)) {
      return;
    }
    throw err;
  }
}

export async function sendEstimate(estimateId: string, input: SendEstimateInput) {
  return withActionError("sendEstimate", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    let estimate;
    try {
      estimate = await db["estimate"]["findFirst"]({
        where: { id: estimateId, orgId },
        include: {
          customer: true,
          items: true,
          linkedInvoice: true,
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        estimate = await db["estimate"]["findFirst"]({
          where: { id: estimateId, orgId },
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            currency: true,
            validUntil: true,
            orgId: true,
            customerId: true,
            projectId: true,
            taxRate: true,
            discount: true,
            subtotal: true,
            taxAmount: true,
            notes: true,
            customer: { select: { id: true, name: true, email: true, company: true } },
            items: { select: { description: true, quantity: true, unitPrice: true, amount: true, sortOrder: true } },
          },
        });
      } else {
        throw err;
      }
    }
    if (!estimate) actionError("Estimate not found");
    if (estimate["status"] !== "DRAFT") actionError("Only draft estimates can be sent");

    const shareToken = randomUUID();
    const baseUrl = process["env"]["NEXT_PUBLIC_BASE_URL"] || process["env"]["NEXTAUTH_URL"] || "http://localhost:3000";
    const shareUrl = `${baseUrl}/estimate/${estimate["number"]}?token=${shareToken}`;

    await db["estimate"]["update"]({
      where: { id: estimateId, orgId },
      data: {
        status: "SENT" as EstimateStatus,
        shareToken,
        sentAt: new Date(),
      },
    });

    await logEstimateAudit(
      estimateId,
      orgId,
      "SENT",
      "DRAFT",
      "SENT",
      input["message"],
      user["id"]
    );

    const customerEmail = estimate["customer"]["email"];
    if (customerEmail) {
      const subject =
        input["subjectOverride"] ||
        `Estimate ${estimate["number"]} from your contractor — Total: ${formatCurrency(estimate["total"], estimate["currency"])}`;

      const shareUrlWithTracking = `${shareUrl}`;

      const htmlBody = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <h1 style="color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px;">Estimate ${estimate["number"]}</h1>
        <p>Hello ${estimate["customer"]["name"] || estimate["customer"]["company"] || "there"},</p>
        <p>${input["message"] || `Please review and approve estimate ${estimate["number"]} below.`}</p>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                <p style="font-size: 16px; color: #6b7280; margin-bottom: 12px;">Total amount: <strong style="color: #111827; font-size: 20px;">${formatCurrency(estimate["total"], estimate["currency"])}</strong></p>
                <p style="font-size: 14px; color: #9ca3af; margin-bottom: 20px;">Valid until: ${formatDate(estimate["validUntil"])}</p>
                <a href="${shareUrlWithTracking}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">View & Approve Estimate</a>
              </div>
              <p style="font-size: 14px; color: #9ca3af;">This estimate is valid until ${formatDate(estimate["validUntil"])}. You can securely view, accept, or reject this estimate using the link above.</p>
              <p style="font-size: 14px; color: #9ca3af;">${process["env"]["NEXT_PUBLIC_COMPANY_NAME"] || "Your contractor"}</p>
            </div>
          </body>
        </html>
      `;

      const ccList = input["ccEmails"]?.["filter"](Boolean) || [];

      await sendEmail({
        to: customerEmail,
        cc: ccList["length"] > 0 ? ccList : undefined,
        subject,
        html: htmlBody,
        text: `Estimate ${estimate["number"]} — Total: ${formatCurrency(estimate["total"], estimate["currency"])}. View & approve: ${shareUrlWithTracking}`,
        metadata: {
          estimateId: estimate["id"],
          estimateNumber: estimate["number"],
          orgId,
          status: "SENT",
        },
      });

      await logEstimateAudit(
        estimateId,
        orgId,
        "EMAIL_SENT",
        "SENT",
        "SENT",
        `Email sent to ${customerEmail}`,
        user["id"]
      );
    }

    await revalidateWithLocale("/dashboard/estimates");
    await revalidateWithLocale(`/dashboard/estimates/${estimateId}`);
    return { estimateId, shareUrl, status: "SENT" };
  });
}

export async function recordEstimateView(token: string) {
  return withActionError("recordEstimateView", async () => {
    let estimate;
    try {
      estimate = await db["estimate"]["findFirst"]({
        where: { shareToken: token },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        actionError("Estimate not found");
      }
      throw err;
    }
    if (!estimate) actionError("Estimate not found");
    if (!["SENT", "VIEWED"]["includes"](estimate["status"])) {
      return { alreadyActioned: true, status: estimate["status"] };
    }

    const data: Record<string, any> = {};
    if (estimate["viewedAt"] === null) {
      data["viewedAt"] = new Date();
    }
    if (estimate["status"] === "SENT") {
      data["status"] = "VIEWED";
    }

    try {
      await db["estimate"]["update"]({
        where: { id: estimate["id"] },
        data,
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        const safeData: Record<string, any> = {};
        if (estimate["status"] === "SENT") {
          safeData["status"] = "VIEWED";
        }
        if (Object["keys"](safeData)["length"] > 0) {
          await db["estimate"]["update"]({
            where: { id: estimate["id"] },
            data: safeData,
          });
        }
      } else {
        throw err;
      }
    }

    await logEstimateAudit(
      estimate["id"],
      estimate["orgId"],
      "VIEWED",
      estimate["status"] === "SENT" ? "VIEWED" : "VIEWED",
      estimate["status"] === "SENT" ? "VIEWED" : "VIEWED"
    );

    return { estimateId: estimate["id"], status: estimate["status"] === "SENT" ? "VIEWED" : estimate["status"] };
  });
}

export async function acceptEstimate(token: string, comment?: string) {
  return withActionError("acceptEstimate", async () => {
    let estimate;
    try {
      estimate = await db["estimate"]["findFirst"]({
        where: { shareToken: token },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        actionError("Estimate not found");
      }
      throw err;
    }
    if (!estimate) actionError("Estimate not found");
    if (estimate["validUntil"] && estimate["validUntil"] < new Date()) {
      actionError("This estimate has expired");
    }
    const allowedStatuses = ["SENT", "VIEWED"];
    if (!allowedStatuses["includes"](estimate["status"])) {
      actionError("This estimate cannot be accepted in its current state");
    }

    let updated: any;
    try {
      updated = await db["estimate"]["update"]({
        where: { id: estimate["id"] },
        data: {
          status: "ACCEPTED" as EstimateStatus,
          acceptedAt: new Date(),
        },
        select: { id: true, acceptedAt: true },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        updated = await db["estimate"]["update"]({
          where: { id: estimate["id"] },
          data: { status: "ACCEPTED" as EstimateStatus },
          select: { id: true },
        });
      } else {
        throw err;
      }
    }

    await logEstimateAudit(
      estimate["id"],
      estimate["orgId"],
      "ACCEPTED",
      estimate["status"],
      "ACCEPTED",
      comment
    );

    await revalidateWithLocale(`/dashboard/estimates`);
    await revalidateWithLocale(`/dashboard/estimates/${estimate["id"]}`);

    return { estimateId: estimate["id"], status: "ACCEPTED", acceptedAt: updated["acceptedAt"] };
  });
}

export async function rejectEstimate(token: string, reason?: string, comment?: string) {
  return withActionError("rejectEstimate", async () => {
    let estimate;
    try {
      estimate = await db["estimate"]["findFirst"]({
        where: { shareToken: token },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        actionError("Estimate not found");
      }
      throw err;
    }
    if (!estimate) actionError("Estimate not found");
    if (!["SENT", "VIEWED"]["includes"](estimate["status"])) {
      actionError("This estimate cannot be rejected in its current state");
    }

    let updated: any;
    try {
      updated = await db["estimate"]["update"]({
        where: { id: estimate["id"] },
        data: {
          status: "REJECTED" as EstimateStatus,
          rejectedAt: new Date(),
          rejectionReason: reason || comment,
        },
        select: { id: true, rejectedAt: true },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        updated = await db["estimate"]["update"]({
          where: { id: estimate["id"] },
          data: {
            status: "REJECTED" as EstimateStatus,
            rejectionReason: reason || comment,
          },
          select: { id: true },
        });
      } else {
        throw err;
      }
    }

    await logEstimateAudit(
      estimate["id"],
      estimate["orgId"],
      "REJECTED",
      estimate["status"],
      "REJECTED",
      reason || comment
    );

    await revalidateWithLocale(`/dashboard/estimates`);
    await revalidateWithLocale(`/dashboard/estimates/${estimate["id"]}`);

    return { estimateId: estimate["id"], status: "REJECTED", rejectedAt: updated["rejectedAt"] };
  });
}

export async function convertEstimateToInvoice(estimateId: string, input: ConvertEstimateInput) {
  return withActionError("convertEstimateToInvoice", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    let estimate;
    try {
      estimate = await db["estimate"]["findFirst"]({
        where: { id: estimateId, orgId },
        include: {
          items: true,
          customer: true,
          project: true,
          linkedInvoice: { select: { id: true, number: true } },
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        estimate = await db["estimate"]["findFirst"]({
          where: { id: estimateId, orgId },
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            currency: true,
            validUntil: true,
            orgId: true,
            customerId: true,
            projectId: true,
            taxRate: true,
            discount: true,
            subtotal: true,
            taxAmount: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
            items: { select: { description: true, quantity: true, unitPrice: true, amount: true, sortOrder: true } },
            customer: { select: { id: true, name: true, email: true, company: true } },
            project: { select: { id: true, name: true } },
          },
        });
      } else {
        throw err;
      }
    }
    if (!estimate) actionError("Estimate not found");
    if (estimate["status"] !== "ACCEPTED") {
      actionError("Only accepted estimates can be converted to invoices");
    }
    if (estimate["validUntil"] && estimate["validUntil"] < new Date()) {
      actionError("This estimate has expired. Duplicate it to create a new one.");
    }
    if ((estimate as any)["linkedInvoice"]) {
      actionError(`This estimate was already converted to invoice ${(estimate as any)["linkedInvoice"]["number"]}.`);
    }

    let number = input["invoiceNumber"];
    if (!number) {
      number = await getNextInvoiceNumber(db, orgId);
    }

    const now = new Date();
    const dueDate = input["dueDate"]
      ? new Date(input["dueDate"])
      : new Date(now["getTime"]() + 30 * 24 * 60 * 60 * 1000);

    try {
      const invoice = await db["invoice"]["create"]({
        data: {
          orgId,
          number,
          customerId: estimate["customerId"],
          projectId: estimate["projectId"] ?? null,
          type: "STANDARD",
          issueDate: now,
          dueDate,
          currency: estimate["currency"],
          taxRate: estimate["taxRate"],
          discount: estimate["discount"],
          subtotal: estimate["subtotal"],
          taxAmount: estimate["taxAmount"],
          total: estimate["total"],
          notes: estimate["notes"],
          createdById: user["id"],
          estimateId: estimate["id"],
          items: {
            create: estimate["items"]["map"]((it) => ({
              description: it["description"],
              quantity: it["quantity"],
              unitPrice: it["unitPrice"],
              amount: it["amount"],
              sortOrder: it["sortOrder"],
            })),
          },
        },
        select: { id: true, number: true },
      });

      const updatedEstimate = await db["estimate"]["update"]({
        where: { id: estimateId, orgId },
        data: {
          status: "INVOICED" as EstimateStatus,
          linkedInvoiceId: invoice["id"],
          convertedAt: new Date(),
        },
        select: { id: true },
      });

      await logEstimateAudit(
        estimateId,
        orgId,
        "CONVERTED_TO_INVOICE",
        "ACCEPTED",
        "INVOICED",
        `Converted to invoice ${invoice["number"]}`,
        user["id"]
      );

      try {
        await db["invoiceAudit"]["create"]({
          data: {
            invoiceId: invoice["id"],
            orgId,
            action: "CREATED_FROM_ESTIMATE",
            fromStatus: null,
            toStatus: "DRAFT",
            note: `Converted from estimate ${estimate["number"]}`,
            createdById: user["id"],
          },
        });
      } catch (auditErr) {
        if (!isMissingColumnError(auditErr)) {
          throw auditErr;
        }
      }

      await revalidateWithLocale("/dashboard/invoices");
      await revalidateWithLocale("/dashboard/estimates");
      await revalidateWithLocale(`/dashboard/estimates/${estimateId}`);

      return {
        invoiceId: invoice["id"],
        invoiceNumber: invoice["number"],
        status: "DRAFT",
      };
    } catch (err) {
      if (isMissingColumnError(err)) {
        const invoice = await db["invoice"]["create"]({
          data: {
            orgId,
            number,
            customerId: estimate["customerId"],
            projectId: estimate["projectId"] ?? null,
            type: "STANDARD",
            issueDate: now,
            dueDate,
            currency: estimate["currency"],
            taxRate: estimate["taxRate"],
            discount: estimate["discount"],
            subtotal: estimate["subtotal"],
            taxAmount: estimate["taxAmount"],
            total: estimate["total"],
            notes: estimate["notes"],
            createdById: user["id"],
            items: {
              create: estimate["items"]["map"]((it) => ({
                description: it["description"],
                quantity: it["quantity"],
                unitPrice: it["unitPrice"],
                amount: it["amount"],
                sortOrder: it["sortOrder"],
              })),
            },
          },
          select: { id: true, number: true },
        });

        const updatedEstimate = await db["estimate"]["update"]({
          where: { id: estimateId, orgId },
          data: {
            status: "INVOICED" as EstimateStatus,
            convertedAt: new Date(),
          },
          select: { id: true },
        });

        await logEstimateAudit(
          estimateId,
          orgId,
          "CONVERTED_TO_INVOICE",
          "ACCEPTED",
          "INVOICED",
          `Converted to invoice ${invoice["number"]}`,
          user["id"]
        );

        await revalidateWithLocale("/dashboard/invoices");
        await revalidateWithLocale("/dashboard/estimates");
        await revalidateWithLocale(`/dashboard/estimates/${estimateId}`);

        return {
          invoiceId: invoice["id"],
          invoiceNumber: invoice["number"],
          status: "DRAFT",
        };
      }
      throw err;
    }
  });
}

export async function getEstimateDetail(estimateId: string) {
  return withActionError("getEstimateDetail", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    let estimate;
    try {
      estimate = await db["estimate"]["findFirst"]({
        where: { id: estimateId, orgId },
        include: {
          customer: true,
          project: true,
          items: { orderBy: { sortOrder: "asc" } },
          linkedInvoice: { select: { id: true, number: true, status: true, total: true } },
          org: { select: { name: true } },
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        estimate = await db["estimate"]["findFirst"]({
          where: { id: estimateId, orgId },
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            currency: true,
            validUntil: true,
            orgId: true,
            customerId: true,
            projectId: true,
            taxRate: true,
            discount: true,
            subtotal: true,
            taxAmount: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
            customer: { select: { id: true, name: true, email: true, company: true, phone: true, address: true, notes: true } },
            project: { select: { id: true, name: true } },
            items: { orderBy: { sortOrder: "asc" }, select: { id: true, description: true, quantity: true, unitPrice: true, amount: true, sortOrder: true } },
          },
        });
      } else {
        throw err;
      }
    }
    if (!estimate) actionError("Estimate not found");

    return estimate;
  });
}

export async function getEstimateAuditLogs(estimateId: string) {
  return withActionError("getEstimateAuditLogs", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const estimate = await db["estimate"]["findFirst"]({
      where: { id: estimateId, orgId },
      select: { id: true },
    });
    if (!estimate) actionError("Estimate not found");

    try {
       const logs = await db["estimateAudit"]["findMany"]({
         where: { estimateId, orgId },
         orderBy: { createdAt: "desc" },
         select: { id: true, action: true, fromStatus: true, toStatus: true, note: true, createdAt: true },
       });
      return logs;
    } catch (err) {
      if (isMissingColumnError(err)) {
        return [];
      }
      throw err;
    }
  });
}

export async function getEstimateByShareToken(token: string) {
  return withActionError("getEstimateByShareToken", async () => {
    try {
      const estimate = await db["estimate"]["findFirst"]({
        where: { shareToken: token },
        include: {
          customer: true,
          project: true,
          items: { orderBy: { sortOrder: "asc" } },
          org: { select: { name: true } },
        },
      });
      if (!estimate) actionError("Estimate not found");
      return estimate;
    } catch (err) {
      if (isMissingColumnError(err)) {
        actionError("Estimate not found");
      }
      throw err;
    }
  });
}

export async function checkExpiredEstimates() {
  return withActionError("checkExpiredEstimates", async () => {
    const now = new Date();

    try {
      const expired = await db["estimate"]["updateMany"]({
        where: {
          status: { in: ["SENT", "VIEWED"] },
          validUntil: { lt: now },
        },
        data: {
          status: "EXPIRED" as EstimateStatus,
        },
      });

      return { count: expired["count"] };
    } catch (err) {
      if (isMissingColumnError(err)) {
        return { count: 0 };
      }
      throw err;
    }
  });
}
