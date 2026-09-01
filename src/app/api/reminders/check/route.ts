import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logError } from "@/lib/logging";
import { isInvalidEnumValueError, isMissingColumnError } from "@/lib/db-drift";
import { isBackgroundJobAuthorized } from "@/lib/background-job-auth";
import { sendEmail, renderTemplate, buildHtmlBody } from "@/lib/email";
import { buildDefaultStages } from "@/lib/invoice-utils";
import { getOrgLocale } from "@/lib/locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ContextResult {
  invoice: any;
  customer: any;
  organization: { name: string };
  invoiceUrl: string;
}

function getBaseUrl(): string {
  return process["env"]["NEXT_PUBLIC_APP_URL"] || process["env"]["NEXTAUTH_URL"] || "http://localhost:3000";
}

function eligibleInvoiceStatuses(): any[] {
  return ["SENT", "VIEWED", "OVERDUE", "UNPAID"];
}

function getDayDifference(now: Date, dueDate: Date): number {
  return Math["floor"]((now["getTime"]() - dueDate["getTime"]()) / 86400000);
}

/**
 * Plan C7: the original comparison was an exact-day match, which meant a
 * missed cron run (a 15-minute window slipping past, a deploy that took
 * longer than expected) silently dropped the reminder. We now treat
 * `daysDiff` as a *window*: PRE_DUE opens at `daysOffset` and closes at
 * `daysOffset + 1`; POST_DUE stays open until the next configured offset
 * to avoid duplicate sends.
 *
 * The `catchup` flag tells the audit row that the stage fired late.
 */
function shouldTriggerStage(
  stage: any,
  daysDiff: number,
  invoice: any
): { trigger: boolean; catchup: boolean } {
  if (!stage["enabled"]) return { trigger: false, catchup: false };

  const { type, daysOffset } = stage;

  if (type === "PRE_DUE") {
    // daysOffset is negative (e.g., -7). Fire when daysDiff is within
    // [daysOffset, daysOffset + 1). A "catchup" is anything past the
    // exact-day boundary.
    const inWindow = daysDiff >= daysOffset && daysDiff < daysOffset + 1;
    if (!inWindow) return { trigger: false, catchup: false };
    return { trigger: true, catchup: daysDiff !== daysOffset };
  }

  if (type === "DUE_DATE") {
    const inWindow = daysDiff >= 0 && daysDiff < 1;
    if (!inWindow) return { trigger: false, catchup: false };
    return { trigger: true, catchup: daysDiff !== 0 };
  }

  if (type === "POST_DUE") {
    // daysOffset is positive (e.g., 1, 7, 14, 30). Fire on the exact day
    // for a clean first send; if the exact day already passed but the
    // frequency cap is still satisfied, fire as a catchup.
    if (invoice["status"] === "PAID") return { trigger: false, catchup: false };
    const inWindow = daysDiff >= daysOffset && daysDiff < daysOffset + 1;
    if (!inWindow) return { trigger: false, catchup: false };
    return { trigger: true, catchup: daysDiff !== daysOffset };
  }

  return { trigger: false, catchup: false };
}

async function checkSuppression(orgId: string, invoiceId: string): Promise<{
  suppressedAll: boolean;
  snoozedUntil: Date | null;
} | null> {
  try {
    const suppression = await db["invoiceReminderSuppression"]["findUnique"]({
      where: { orgId_invoiceId: { orgId, invoiceId } },
      select: { suppressedAll: true, snoozedUntil: true },
    });
    return suppression;
  } catch (err) {
    if (isMissingColumnError(err)) return null;
    throw err;
  }
}

async function loadStages(configId: string): Promise<any[]> {
  try {
    return await db["reminderStage"]["findMany"]({
      where: { configId, enabled: true },
      orderBy: { daysOffset: "asc" },
    });
  } catch (err) {
    if (isMissingColumnError(err)) return [];
    throw err;
  }
}

async function alreadySentForStage(invoiceId: string, stageId: string | null, type: string): Promise<boolean> {
  const where: any = {
    invoiceId,
    status: { in: ["SENT", "DELIVERED", "QUEUED"] },
  };
  if (stageId) {
    where["stageId"] = stageId;
  } else {
    where["type"] = type;
  }

  try {
    const count = await db["reminder"]["count"]({ where });
    return count > 0;
  } catch (err) {
    if (isMissingColumnError(err)) {
      const fallbackCount = await db["reminder"]["count"]({
        where: {
          invoiceId,
          status: { in: ["SENT", "DELIVERED", "QUEUED"] },
          type,
        },
      });
      return fallbackCount > 0;
    }
    return false;
  }
}

async function checkGlobalFrequencyCap(invoiceId: string, config: any): Promise<boolean> {
  const since = new Date(Date["now"]() - config["frequencyHours"] * 60 * 60 * 1000);
  try {
    const count = await db["reminder"]["count"]({
      where: {
        invoiceId,
        status: { in: ["SENT", "DELIVERED", "QUEUED"] },
        createdAt: { gte: since },
      },
    });
    return count >= config["maxReminders"];
  } catch (err) {
    if (isMissingColumnError(err)) return false;
    throw err;
  }
}

function buildSendContext(invoice: any, customer: any, orgName: string, locale: string): ContextResult {
  const baseUrl = getBaseUrl();
  const invoiceUrl = `${baseUrl}/${locale}/invoices/${invoice["id"]}`;

  return {
    invoice: {
      id: invoice["id"],
      number: invoice["number"],
      total: invoice["total"],
      amountPaid: invoice["amountPaid"],
      currency: invoice["currency"],
      issueDate: invoice["issueDate"],
      dueDate: invoice["dueDate"],
      status: invoice["status"],
    },
    customer: {
      name: customer?.["name"],
      email: customer?.["email"],
      company: customer?.["company"],
    },
    organization: { name: orgName },
    invoiceUrl,
  };
}

async function deliverReminder(
  invoice: any,
  stage: any,
  config: any,
  orgId: string,
  ctx: ContextResult,
  options: { catchup: boolean } = { catchup: false }
) {
  const recipient = ctx["customer"]["email"];
  if (!recipient) {
    return {
      status: "SKIPPED" as const,
      error: "No email address on customer record",
    };
  }

  const subject = renderTemplate(stage["subjectTemplate"] || config["emailSubject"] || "Payment reminder", ctx);
  const bodyHtml = buildHtmlBody(stage["bodyTemplate"] || config["emailTemplate"] || "", ctx);
  const bodyText = renderTemplate(stage["bodyTemplate"] || config["emailTemplate"] || "", ctx);

  const emailResult = await sendEmail({
    to: recipient,
    subject,
    html: bodyHtml,
    text: bodyText,
    metadata: {
      invoiceId: invoice["id"],
      stageId: stage["id"] ?? "",
    },
  });

  const now = new Date();
  const reminderStatus = emailResult["success"]
    ? (emailResult["status"] === "QUEUED" ? "QUEUED" : "DELIVERED")
    : "FAILED";

  const type = stage["type"] === "PRE_DUE"
    ? "PRE_DUE"
    : stage["type"] === "DUE_DATE"
      ? "DUE_DATE"
      : `POST_DUE_${stage["daysOffset"]}`;

  const baseNote = `Automated ${stage["name"]} reminder sent for invoice ${invoice["number"]}`;
  const note = options["catchup"] ? `${baseNote} (catchup)` : baseNote;

  try {
    await db["reminder"]["create"]({
      data: {
        orgId,
        invoiceId: invoice["id"],
        stageId: stage["id"] ?? undefined,
        type,
        scheduledAt: now,
        sentAt: emailResult["success"] ? now : null,
        deliveredAt: emailResult["success"] && emailResult["status"] === "DELIVERED" ? now : null,
        status: reminderStatus,
        channel: "EMAIL",
        recipient,
        subject,
        errorMessage: emailResult["error"],
        metadata: emailResult["metadata"]
          ? { provider: emailResult["metadata"]["provider"], messageId: emailResult["messageId"] }
          : undefined,
        note,
      },
    });
  } catch (err) {
    if (isMissingColumnError(err)) {
      // Schema drift fallback — record with minimal fields
      await db["reminder"]["create"]({
        data: {
          orgId,
          invoiceId: invoice["id"],
          type,
          scheduledAt: now,
          sentAt: emailResult["success"] ? now : null,
          status: reminderStatus,
          channel: "EMAIL",
          note,
        },
      });
    } else {
      throw err;
    }
  }

  try {
    await db["invoiceAudit"]["create"]({
      data: {
        invoiceId: invoice["id"],
        orgId,
        action: "REMINDER_SENT",
        toStatus: invoice["status"],
        note: options["catchup"]
          ? `Automated ${stage["name"]} reminder (catchup) sent to ${recipient}`
          : `Automated ${stage["name"]} reminder sent to ${recipient}`,
      },
    });
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
  }

  return {
    status: reminderStatus,
    messageId: emailResult["messageId"],
    error: emailResult["error"],
  };
}

export async function GET(req: NextRequest) {
  if (!isBackgroundJobAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const now = new Date();
    const results: any[] = [];

    let configs;
    try {
      configs = await db["reminderConfig"]["findMany"]({
        where: { enabled: true },
        include: {
          org: { select: { id: true, name: true } },
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        configs = await db["reminderConfig"]["findMany"]({
          where: { enabled: true },
          select: {
            id: true,
            orgId: true,
            enabled: true,
            frequencyHours: true,
            maxReminders: true,
            emailSubject: true,
            emailTemplate: true,
            remindBeforeDue: true,
            remindAfterDue: true,
            createdAt: true,
            updatedAt: true,
            org: { select: { id: true, name: true } },
          },
        });
      } else {
        throw err;
      }
    }

    for (const config of configs) {
      const orgId = config["orgId"];
      const orgLocale = await getOrgLocale(orgId);

      // Load stages (falls back to legacy derived stages if table is missing)
      let stages = await loadStages(config["id"]);

      if (stages["length"] === 0) {
        // Legacy mode: derive stages from remindBeforeDue / remindAfterDue
        stages = buildDefaultStages(config);
        // Mark them as "legacy" — we use the legacy fields directly
        stages = stages["map"]((s) => ({
          ...s,
          id: null,
          type: s["type"],
          enabled: true,
          daysOffset: s["daysOffset"],
          subjectTemplate: config["emailSubject"],
          bodyTemplate: config["emailTemplate"],
        }));
      }

      if (stages["length"] === 0) continue;

      let invoices: any[];
      try {
        invoices = await db["invoice"]["findMany"]({
          where: {
            orgId,
            status: { in: eligibleInvoiceStatuses() },
          },
          include: { customer: { select: { name: true, email: true, company: true } } },
        });
      } catch (err) {
        if (isInvalidEnumValueError(err) || isMissingColumnError(err)) {
          invoices = await db["invoice"]["findMany"]({
            where: {
              orgId,
              status: { in: ["SENT", "OVERDUE", "VIEWED"] },
            },
            select: {
              id: true,
              number: true,
              total: true,
              amountPaid: true,
              currency: true,
              issueDate: true,
              dueDate: true,
              status: true,
              customer: { select: { name: true, email: true, company: true } },
            },
          });
        } else {
          throw err;
        }
      }

      for (const invoice of invoices) {
        if (!invoice["dueDate"]) continue;

        // Skip invoices with no remaining balance
        if (invoice["amountPaid"] >= invoice["total"]) continue;

        // Check per-invoice suppression
        const suppression = await checkSuppression(orgId, invoice["id"]);
        if (suppression) {
          if (suppression["suppressedAll"]) continue;
          if (suppression["snoozedUntil"] && now["getTime"]() < new Date(suppression["snoozedUntil"])["getTime"]()) continue;
        }

        const dueDate = new Date(invoice["dueDate"]);
        const daysDiff = getDayDifference(now, dueDate);
        const ctx = buildSendContext(invoice, invoice["customer"], config["org"]["name"], orgLocale);

        for (const stage of stages) {
          if (!stage["enabled"]) continue;

          const { trigger: shouldTrigger, catchup } = shouldTriggerStage(stage, daysDiff, invoice);
          if (!shouldTrigger) continue;

          // Deduplication: has this stage already been sent for this invoice?
          const stageId = stage["id"] ?? null;
          const dupCheck = stage["id"]
            ? { stageId: stage["id"] }
            : { type: stage["type"] === "PRE_DUE" ? "PRE_DUE" : stage["type"] === "DUE_DATE" ? "DUE_DATE" : `POST_DUE_${stage["daysOffset"]}` };

          const alreadySent = await alreadySentForStage(
            invoice["id"],
            stageId,
            stage["type"] === "PRE_DUE" ? "PRE_DUE"
              : stage["type"] === "DUE_DATE" ? "DUE_DATE"
              : `POST_DUE_${stage["daysOffset"]}`
          );
          if (alreadySent) continue;

          // Global frequency cap check
          const atCap = await checkGlobalFrequencyCap(invoice["id"], config);
          if (atCap) continue;

          const delivery = await deliverReminder(invoice, stage, config, orgId, ctx, { catchup });

          results["push"]({
            org: config["org"]["name"],
            invoice: invoice["number"],
            stage: stage["name"],
            type: delivery["status"],
            recipient: ctx["customer"]["email"],
            messageId: delivery["messageId"],
          });

          if (delivery["error"]) {
            results[results["length"] - 1]["error"] = delivery["error"];
          }
        }
      }
    }

    return NextResponse["json"]({
      success: true,
      remindersSent: results["length"],
      details: results,
    });
  } catch (err) {
    logError("reminders-check", err);
    return NextResponse["json"]({ error: "Failed to process reminders." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
