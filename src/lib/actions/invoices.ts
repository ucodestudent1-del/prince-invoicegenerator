"use server";

import { db, withRetry } from "@/lib/db";
import { requireUser, isMissingColumnError, isInvalidEnumValueError, getActivePlan } from "@/lib/org";
import { INVOICE_LIMITS } from "@/lib/plans";
import { withActionError, actionError } from "@/lib/action-errors";
import { getNextInvoiceNumber } from "@/lib/numbering";
import { revalidateWithLocale } from "@/lib/revalidate";
import { buildDefaultStages } from "@/lib/invoice-utils";
import { InvoiceType, PaymentMethod, PaymentStatus, InvoiceStatus } from "@prisma/client";
import { coerceEnum } from "@/lib/utils";

export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  sku?: string | null;
}

export interface CreateInvoiceInput {
  customerId: string;
  projectId?: string | null;
  type: InvoiceType;
  issueDate: string;
  dueDate?: string | null;
  currency?: string;
  taxRate: number;
  discount: number;
  retainageRate: number;
  notes?: string;
  invoiceNumber?: string | null;
  logoUrl?: string | null;
  billToAddress?: string | null;
  shipToAddress?: string | null;
  items: InvoiceItemInput[];
  scheduledFor?: string | null;
  estimateId?: string | null;
}

export async function createInvoice(input: CreateInvoiceInput) {
  return withActionError("createInvoice", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    if (!input["customerId"]) {
      actionError("Customer is required.");
    }

    const customerExists = await withRetry(() =>
      db["customer"]["findFirst"]({
        where: { id: input["customerId"], orgId },
        select: { id: true },
      })
    );
    if (!customerExists) {
      actionError("Selected customer does not exist or has been deleted.");
    }

    if (input["projectId"]) {
      const projectExists = await withRetry(() =>
        db["project"]["findFirst"]({
          where: { id: input["projectId"]!, orgId },
          select: { id: true },
        })
      );
      if (!projectExists) {
        actionError("Selected project does not exist or has been deleted.");
      }
    }

    const validItems = input["items"]["filter"](
      (it) => it["description"] && it["quantity"] > 0 && it["unitPrice"] > 0
    );
    if (validItems["length"] === 0) {
      actionError("At least one line item with a description, quantity, and unit price is required.");
    }

    const unlockAll =
      process["env"]["NEXT_PUBLIC_UNLOCK_ALL_FEATURES"] === "true";
    const activePlan = await getActivePlan(user);
    const limit = unlockAll ? null : INVOICE_LIMITS[activePlan];
    if (limit !== null) {
      const startOfMonth = new Date();
      startOfMonth["setDate"](1);
      startOfMonth["setHours"](0, 0, 0, 0);
      const count = await withRetry(() =>
        db["invoice"]["count"]({
          where: {
            orgId,
            createdAt: { gte: startOfMonth },
            status: { not: InvoiceStatus.DRAFT },
          },
        })
      );
      if (count >= limit) {
        actionError(
          `Your ${activePlan} plan is limited to ${limit} invoices per month. Upgrade to create more.`
        );
      }
    }

    const subtotal = validItems["reduce"](
      (acc, it) => acc + it["quantity"] * it["unitPrice"],
      0
    );
    const taxAmount = (subtotal * input["taxRate"]) / 100;
    const total = subtotal + taxAmount - input["discount"];
    const retainageAmount = (total * input["retainageRate"]) / 100;

    let number = input["invoiceNumber"];
    if (!number) {
      number = await getNextInvoiceNumber(db, orgId);
    }

    let invoice;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        invoice = await db["invoice"]["create"]({
          data: {
            orgId,
            number,
            customerId: input["customerId"],
            projectId: input["projectId"] ?? null,
            type: coerceEnum(input["type"], InvoiceType, "type"),
            issueDate: new Date(input["issueDate"]),
            dueDate: input["dueDate"] ? new Date(input["dueDate"]) : null,
            currency: input["currency"] ?? "USD",
            taxRate: input["taxRate"],
            discount: input["discount"],
            retainageRate: input["retainageRate"],
            retainageAmount,
            subtotal,
            taxAmount,
            total,
            notes: input["notes"],
            logoUrl: input["logoUrl"] ?? null,
            billToAddress: input["billToAddress"] ?? null,
            shipToAddress: input["shipToAddress"] ?? null,
            scheduledFor: input["scheduledFor"] ? new Date(input["scheduledFor"]) : null,
            estimateId: input["estimateId"] ?? null,
            createdById: user["id"],
            items: {
              create: validItems["map"]((it, i) => ({
                description: it["description"],
                quantity: it["quantity"],
                unitPrice: it["unitPrice"],
                amount: it["quantity"] * it["unitPrice"],
                sortOrder: i,
                sku: it["sku"] || null,
              })),
            },
          },
        });
        break;
      } catch (err) {
        if (
          err instanceof Error &&
          err["message"]["includes"]("Unique constraint failed") &&
          attempt < 3
        ) {
          number = await getNextInvoiceNumber(db, orgId);
          continue;
        }
        if (isMissingColumnError(err)) {
          // Schema drift: columns like billToAddress, shipToAddress, scheduledFor
          // may not exist in the database if migrations haven't been applied.
          // Retry without those fields so invoice creation succeeds.
          invoice = await db["invoice"]["create"]({
            data: {
              orgId,
              number,
              customerId: input["customerId"],
              projectId: input["projectId"] ?? null,
              type: coerceEnum(input["type"], InvoiceType, "type"),
              issueDate: new Date(input["issueDate"]),
              dueDate: input["dueDate"] ? new Date(input["dueDate"]) : null,
              currency: input["currency"] ?? "USD",
              taxRate: input["taxRate"],
              discount: input["discount"],
              retainageRate: input["retainageRate"],
              retainageAmount,
              subtotal,
              taxAmount,
              total,
              notes: input["notes"],
              createdById: user["id"],
              items: {
                create: validItems["map"]((it, i) => ({
                  description: it["description"],
                  quantity: it["quantity"],
                  unitPrice: it["unitPrice"],
                  amount: it["quantity"] * it["unitPrice"],
                  sortOrder: i,
                })),
              },
            },
          });
          break;
        }
        throw err;
      }
    }

    await revalidateWithLocale("/dashboard/invoices");
    await revalidateWithLocale("/dashboard");
    return invoice;
  });
}

export async function markInvoiceStatus(id: string, status: InvoiceStatus) {
  return withActionError("markInvoiceStatus", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const invoice = await db["invoice"]["findFirst"]({
      where: { id, orgId: user["organizationId"] },
      select: { id: true, status: true, total: true, amountPaid: true },
    });
    if (!invoice) actionError("Not found");

    const previousStatus = invoice["status"];

    let amountPaid = invoice["amountPaid"];
    if (status === "PAID") {
      amountPaid = invoice["total"];
    } else if (status === "UNPAID" || status === "DRAFT" || status === "VOID") {
      amountPaid = 0;
    }

    try {
      await db["invoice"]["update"]({
        where: { id, orgId },
        data: { status, amountPaid },
      });
    } catch (err: any) {
      if (isInvalidEnumValueError(err) && status === "UNPAID") {
        // UNPAID enum value may not exist in the database yet —
        // fall back to SENT status to indicate the invoice has a balance
        await db["invoice"]["update"]({
          where: { id, orgId },
          data: { status: "SENT", amountPaid },
        });
      } else {
        throw err;
      }
    }

    await db["invoiceAudit"]["create"]({
      data: {
        invoiceId: id,
        orgId,
        action: "STATUS_CHANGE",
        fromStatus: previousStatus,
        toStatus: status,
        createdById: user["id"],
      },
    });

    await revalidateWithLocale("/dashboard/invoices");
    await revalidateWithLocale(`/dashboard/invoices/${id}`);
  });
}

export async function markInvoicePaid(id: string) {
  return markInvoiceStatus(id, "PAID");
}

export async function recordPayment(input: {
  invoiceId: string;
  amount: number;
  method?: PaymentMethod;
  note?: string;
  stripePaymentId?: string;
  paypalTransactionId?: string;
}) {
  return withActionError("recordPayment", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    if (!input["invoiceId"]) actionError("Invoice is required.");
    const roundedAmount = Math["round"](input["amount"] * 100) / 100;
    if (!roundedAmount || roundedAmount <= 0) actionError("Payment amount must be greater than zero.");

    const invoice = await db["invoice"]["findFirst"]({
      where: { id: input["invoiceId"], orgId },
      select: { id: true, total: true, amountPaid: true, status: true },
    });
    if (!invoice) actionError("Invoice not found.");

    const roundedTotal = Math["round"](invoice["total"] * 100) / 100;
    const roundedAmountPaid = Math["round"](invoice["amountPaid"] * 100) / 100;
    const remaining = Math["round"]((roundedTotal - roundedAmountPaid) * 100) / 100;
    if (roundedAmount > remaining + 0.01) {
      actionError(`Payment amount exceeds remaining balance of ${remaining["toFixed"](2)}.`);
    }

    const newAmountPaid = Math["round"]((Math["min"](roundedAmountPaid + roundedAmount, roundedTotal)) * 100) / 100;

    await db["$transaction"](async (tx) => {
      const freshInvoice = await tx["invoice"]["findFirst"]({
        where: { id: input["invoiceId"], orgId },
        select: { id: true, total: true, amountPaid: true, status: true },
      });
      if (!freshInvoice) actionError("Invoice not found.");

      const freshTotal = Math["round"](freshInvoice["total"] * 100) / 100;
      const freshAmountPaid = Math["round"](freshInvoice["amountPaid"] * 100) / 100;
      const adjustedAmountPaid = Math["round"]((Math["min"](freshAmountPaid + roundedAmount, freshTotal)) * 100) / 100;

      const payment = await tx["payment"]["create"]({
        data: {
          invoiceId: input["invoiceId"],
          orgId,
          amount: roundedAmount,
          method: input["method"] ? coerceEnum(input["method"], PaymentMethod, "method") : "OTHER",
          status: "COMPLETED",
          stripePaymentId: input["stripePaymentId"],
          paypalTransactionId: input["paypalTransactionId"],
          note: input["note"],
        },
      });

      let newStatus = freshInvoice["status"];
      if (adjustedAmountPaid >= freshTotal) {
        newStatus = "PAID";
      } else if (freshInvoice["status"] === "PAID" || freshInvoice["status"] === "VOID") {
        newStatus = "UNPAID";
      }

      try {
        await tx["invoice"]["update"]({
          where: { id: input["invoiceId"], orgId },
          data: { amountPaid: adjustedAmountPaid, status: newStatus },
        });
      } catch (err: any) {
        if (isInvalidEnumValueError(err) && newStatus === "UNPAID") {
          await tx["invoice"]["update"]({
            where: { id: input["invoiceId"], orgId },
            data: { amountPaid: adjustedAmountPaid, status: "SENT" },
          });
        } else {
          throw err;
        }
      }

      await tx["invoiceAudit"]["create"]({
        data: {
          invoiceId: input["invoiceId"],
          orgId,
          action: "PAYMENT_RECORDED",
          toStatus: newStatus,
          amount: roundedAmount,
          note: input["note"],
          createdById: user["id"],
        },
      });

      return payment;
    });

    await revalidateWithLocale("/dashboard/invoices");
    await revalidateWithLocale(`/dashboard/invoices/${input["invoiceId"]}`);
  });
}

export async function getInvoicePayments(invoiceId: string) {
  return withActionError("getInvoicePayments", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const invoice = await db["invoice"]["findFirst"]({
      where: { id: invoiceId, orgId },
      select: { id: true },
    });
    if (!invoice) actionError("Not found");

    const payments = await db["payment"]["findMany"]({
      where: { invoiceId },
      orderBy: { createdAt: "desc" },
    });

    return payments;
  });
}

export async function getInvoiceAuditLogs(invoiceId: string) {
  return withActionError("getInvoiceAuditLogs", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    const invoice = await db["invoice"]["findFirst"]({
      where: { id: invoiceId, orgId: user["organizationId"] },
      select: { id: true },
    });
    if (!invoice) actionError("Not found");

    const logs = await db["invoiceAudit"]["findMany"]({
      where: { invoiceId },
      orderBy: { createdAt: "desc" },
    });

    return logs;
  });
}

export async function getReminderConfig() {
  return withActionError("getReminderConfig", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    const config = await db["reminderConfig"]["findUnique"]({
      where: { orgId: user["organizationId"] },
      include: { stages: { orderBy: { daysOffset: "asc" } } },
    });

    if (!config) {
      return null;
    }

    // If stages are empty (legacy DB without the new table), build them
    // from the legacy remindBeforeDue / remindAfterDue fields so the UI
    // always has a consistent shape to render.
    if (config["stages"]["length"] === 0) {
      const stages = buildDefaultStages(config);
      return {
        ...config,
        stages,
      };
    }

    return config;
  });
}

export interface ReminderStageInput {
  id?: string;
  name: string;
  type: "PRE_DUE" | "DUE_DATE" | "POST_DUE";
  enabled: boolean;
  daysOffset: number;
  timeOfDay?: string | null;
  subjectTemplate?: string | null;
  bodyTemplate?: string | null;
  channel?: string;
}

export async function saveReminderConfig(input: {
  enabled: boolean;
  frequencyHours: number;
  maxReminders: number;
  remindBeforeDue?: number;
  remindAfterDue?: number;
  emailSubject?: string | null;
  emailTemplate?: string | null;
  stages?: ReminderStageInput[];
}) {
  return withActionError("saveReminderConfig", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const config = await db["reminderConfig"]["upsert"]({
      where: { orgId },
      update: {
        enabled: input["enabled"],
        remindBeforeDue: input["remindBeforeDue"] ?? 7,
        remindAfterDue: input["remindAfterDue"] ?? 1,
        frequencyHours: input["frequencyHours"],
        maxReminders: input["maxReminders"],
        emailSubject: input["emailSubject"],
        emailTemplate: input["emailTemplate"],
      },
      create: {
        orgId,
        enabled: input["enabled"],
        remindBeforeDue: input["remindBeforeDue"] ?? 7,
        remindAfterDue: input["remindAfterDue"] ?? 1,
        frequencyHours: input["frequencyHours"],
        maxReminders: input["maxReminders"],
        emailSubject: input["emailSubject"],
        emailTemplate: input["emailTemplate"],
      },
    });

    // Sync stages — only if the stages table/columns exist.
    if (input["stages"] && input["stages"]["length"] > 0) {
      const stageIdsToKeep = new Set<string>();
      for (const stage of input["stages"]) {
        stageIdsToKeep["add"](stage["name"]);

        if (stage["id"]) {
          await db["reminderStage"]["update"]({
            where: { id: stage["id"] },
            data: {
              configId: config["id"],
              name: stage["name"],
              type: stage["type"],
              enabled: stage["enabled"],
              daysOffset: stage["daysOffset"],
              timeOfDay: stage["timeOfDay"] ?? null,
              subjectTemplate: stage["subjectTemplate"] ?? null,
              bodyTemplate: stage["bodyTemplate"] ?? null,
              channel: stage["channel"] ?? "EMAIL",
            },
          })["catch"](() => {});
        } else {
          await db["reminderStage"]["create"]({
            data: {
              configId: config["id"],
              name: stage["name"],
              type: stage["type"],
              enabled: stage["enabled"],
              daysOffset: stage["daysOffset"],
              timeOfDay: stage["timeOfDay"] ?? null,
              subjectTemplate: stage["subjectTemplate"] ?? null,
              bodyTemplate: stage["bodyTemplate"] ?? null,
              channel: stage["channel"] ?? "EMAIL",
            },
          })["catch"](() => {});
        }
      }

      // Remove stages that were not in the payload
      await db["reminderStage"]["deleteMany"]({
        where: {
          configId: config["id"],
          name: { notIn: Array["from"](stageIdsToKeep) },
        },
      })["catch"](() => {});
    }

    await revalidateWithLocale("/dashboard/settings/reminders");
    return config;
  });
}

export async function sendReminder(invoiceId: string) {
  return withActionError("sendReminder", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    let invoice;
    let config;
    try {
      const result = await Promise["all"]([
        db["invoice"]["findFirst"]({
          where: { id: invoiceId, orgId },
          include: { customer: true },
        }),
        db["reminderConfig"]["findUnique"]({ where: { orgId } }),
      ]);
      invoice = result[0];
      config = result[1];
    } catch (err: any) {
      if (isMissingColumnError(err)) {
        invoice = await db["invoice"]["findFirst"]({
          where: { id: invoiceId, orgId },
          select: {
            id: true,
            number: true,
            total: true,
            amountPaid: true,
            status: true,
            currency: true,
            issueDate: true,
            dueDate: true,
            customer: { select: { id: true, name: true, email: true, company: true } },
          },
        });
        config = await db["reminderConfig"]["findUnique"]({ where: { orgId } });
      } else {
        throw err;
      }
    }

    if (!invoice) return null;
    if (!config?.["enabled"]) return null;

    const now = new Date();
    let type = "DUE_DATE";
    let stageId: string | null = null;

    try {
      const stages = await db["reminderStage"]["findMany"]({
        where: { configId: config["id"], enabled: true },
        orderBy: { daysOffset: "asc" },
      });
      if (stages["length"] > 0) {
        if (invoice["dueDate"] && now > invoice["dueDate"]) {
          // Find the most appropriate post-due stage (smallest positive offset <= days overdue)
          const daysOverdue = Math["floor"]((now["getTime"]() - invoice["dueDate"]["getTime"]()) / 86400000);
          const postDueStage = stages
            ["filter"]((s) => s["type"] === "POST_DUE" && s["daysOffset"] <= daysOverdue)
            ["sort"]((a, b) => b["daysOffset"] - a["daysOffset"])[0];
          if (postDueStage) {
            type = `POST_DUE_${postDueStage["daysOffset"]}`;
            stageId = postDueStage["id"];
          } else {
            const dueDateStage = stages["find"]((s) => s["type"] === "DUE_DATE");
            if (dueDateStage) {
              stageId = dueDateStage["id"];
            }
          }
        } else {
          const dueDateStage = stages["find"]((s) => s["type"] === "DUE_DATE");
          if (dueDateStage) {
            stageId = dueDateStage["id"];
          } else {
            const earlyStage = stages["find"]((s) => s["type"] === "PRE_DUE");
            if (earlyStage) stageId = earlyStage["id"];
          }
        }
      }
    } catch (err: any) {
      // Schema drift: stages table may not exist yet. Fall back to legacy behavior.
      if (!isMissingColumnError(err)) throw err;
    }

    const recentReminders = await db["reminder"]["count"]({
      where: {
        invoiceId,
        status: { in: ["SENT", "DELIVERED", "QUEUED"] },
        createdAt: { gte: new Date(now["getTime"]() - config["frequencyHours"] * 60 * 60 * 1000) },
      },
    });

    if (recentReminders >= config["maxReminders"]) {
      actionError(`Maximum number of reminders (${config["maxReminders"]}) reached for this invoice.`);
    }

    const reminder = await db["reminder"]["create"]({
      data: {
        orgId,
        invoiceId,
        stageId: stageId ?? undefined,
        type,
        scheduledAt: now,
        sentAt: now,
        status: "SENT",
        channel: "EMAIL",
        note: `Reminder sent for invoice ${invoice["number"]}`,
      },
    });

    await db["invoiceAudit"]["create"]({
      data: {
        invoiceId,
        orgId,
        action: "REMINDER_SENT",
        toStatus: invoice["status"],
        note: `Automated ${type} reminder sent`,
        createdById: user["id"],
      },
    });

    await revalidateWithLocale(`/dashboard/invoices/${invoiceId}`);
    return reminder;
  });
}

export async function getReminders(input: { invoiceId?: string; status?: string }) {
  return withActionError("getReminders", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    const where: any = { orgId: user["organizationId"] };
    if (input["invoiceId"]) where["invoiceId"] = input["invoiceId"];
    if (input["status"]) {
      const ReminderStatus = {
        PENDING: "PENDING",
        SENT: "SENT",
        QUEUED: "QUEUED",
        DELIVERED: "DELIVERED",
        FAILED: "FAILED",
        BOUNCED: "BOUNCED",
        SKIPPED: "SKIPPED",
      } as const;
      where["status"] = coerceEnum(input["status"], ReminderStatus, "status");
    }

    const reminders = await db["reminder"]["findMany"]({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        invoice: {
          select: { number: true, status: true },
        },
        stage: {
          select: { name: true, type: true, daysOffset: true },
        },
      },
    });

    return reminders;
  });
}

export async function getInvoiceReminderSuppression(invoiceId: string) {
  return withActionError("getInvoiceReminderSuppression", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    try {
      const suppression = await db["invoiceReminderSuppression"]["findUnique"]({
        where: { orgId_invoiceId: { orgId: user["organizationId"], invoiceId } },
      });
      return suppression;
    } catch (err) {
      if (isMissingColumnError(err)) return null;
      throw err;
    }
  });
}

export async function setInvoiceReminderSuppression(
  invoiceId: string,
  input: { suppressedAll?: boolean; snoozedUntil?: string | null }
) {
  return withActionError("setInvoiceReminderSuppression", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    await db["$transaction"](async (tx) => {
      await tx["invoiceReminderSuppression"]["upsert"]({
        where: { orgId_invoiceId: { orgId, invoiceId } },
        update: {
          suppressedAll: input["suppressedAll"] ?? false,
          snoozedUntil: input["snoozedUntil"] ? new Date(input["snoozedUntil"]) : null,
        },
        create: {
          orgId,
          invoiceId,
          suppressedAll: input["suppressedAll"] ?? false,
          snoozedUntil: input["snoozedUntil"] ? new Date(input["snoozedUntil"]) : null,
        },
      });
    });

    await revalidateWithLocale(`/dashboard/invoices/${invoiceId}`);
  });
}

export async function clearInvoiceReminderSuppression(invoiceId: string) {
  return withActionError("clearInvoiceReminderSuppression", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    try {
      await db["invoiceReminderSuppression"]["deleteMany"]({
        where: { orgId: user["organizationId"], invoiceId },
      });
    } catch (err) {
      if (isMissingColumnError(err)) return null;
      throw err;
    }

    await revalidateWithLocale(`/dashboard/invoices/${invoiceId}`);
  });
}

export async function deleteInvoice(id: string) {
  return withActionError("deleteInvoice", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    await db["invoice"]["deleteMany"]({ where: { id, orgId: user["organizationId"] } });
    await revalidateWithLocale("/dashboard/invoices");
  });
}

export async function getScheduledInvoices(orgId: string) {
  return withActionError("getScheduledInvoices", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    let invoices: any[] = [];
    try {
      invoices = await db["invoice"]["findMany"]({
        where: {
          orgId: user["organizationId"],
          status: "DRAFT",
          scheduledFor: { not: null },
        },
        include: {
          customer: { select: { name: true } },
        },
        orderBy: { scheduledFor: "asc" },
      });
    } catch (err: any) {
      if (isMissingColumnError(err)) {
        invoices = [];
      } else {
        throw err;
      }
    }

    return invoices;
  });
}

export async function getAvailableInvoices() {
  return withActionError("getAvailableInvoices", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    return await db["invoice"]["findMany"]({
      where: { orgId, recurringConfigId: null },
      select: { id: true, number: true, type: true },
      orderBy: { createdAt: "desc" },
    });
  });
}

