"use server";

import { revalidatePath } from "next/cache";
import { db, withRetry } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { INVOICE_LIMITS } from "@/lib/plans";
import { withActionError, actionError } from "@/lib/action-errors";
import type { InvoiceType, PaymentMethod, PaymentStatus, InvoiceStatus } from "@prisma/client";

export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
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
}

export async function createInvoice(input: CreateInvoiceInput) {
  return withActionError("createInvoice", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    if (!input.customerId) {
      actionError("Customer is required.");
    }

    const customerExists = await withRetry(() =>
      db.customer.findFirst({
        where: { id: input.customerId, orgId },
        select: { id: true },
      })
    );
    if (!customerExists) {
      actionError("Selected customer does not exist or has been deleted.");
    }

    if (input.projectId) {
      const projectExists = await withRetry(() =>
        db.project.findFirst({
          where: { id: input.projectId!, orgId },
          select: { id: true },
        })
      );
      if (!projectExists) {
        actionError("Selected project does not exist or has been deleted.");
      }
    }

    const validItems = input.items.filter(
      (it) => it.description && it.quantity > 0 && it.unitPrice > 0
    );
    if (validItems.length === 0) {
      actionError("At least one line item with a description, quantity, and unit price is required.");
    }

    const limit = INVOICE_LIMITS.FREE;
    if (limit !== null) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const count = await withRetry(() =>
        db.invoice.count({
          where: { orgId, createdAt: { gte: startOfMonth } },
        })
      );
      if (count >= limit) {
        actionError(
          `Your Free plan is limited to ${limit} invoices per month. Upgrade to create more.`
        );
      }
    }

    const subtotal = validItems.reduce(
      (acc, it) => acc + it.quantity * it.unitPrice,
      0
    );
    const taxAmount = (subtotal * input.taxRate) / 100;
    const total = subtotal + taxAmount - input.discount;
    const retainageAmount = (total * input.retainageRate) / 100;

    const count = await withRetry(() => db.invoice.count({ where: { orgId } }));
    const number = input.invoiceNumber || `INV-${String(count + 1).padStart(4, "0")}`;

    const invoice = await db.invoice.create({
      data: {
        orgId,
        number,
        customerId: input.customerId,
        projectId: input.projectId ?? null,
        type: input.type,
        issueDate: new Date(input.issueDate),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        currency: input.currency ?? "USD",
        taxRate: input.taxRate,
        discount: input.discount,
        retainageRate: input.retainageRate,
        retainageAmount,
        subtotal,
        taxAmount,
        total,
        notes: input.notes,
        logoUrl: input.logoUrl ?? null,
        billToAddress: input.billToAddress ?? null,
        shipToAddress: input.shipToAddress ?? null,
        createdById: user.id,
        items: {
          create: validItems.map((it, i) => ({
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            amount: it.quantity * it.unitPrice,
            sortOrder: i,
          })),
        },
      },
    });

    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard");
    return invoice;
  });
}

export async function markInvoiceStatus(id: string, status: InvoiceStatus) {
  return withActionError("markInvoiceStatus", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    const invoice = await db.invoice.findFirst({
      where: { id, orgId: user.organizationId },
      select: { id: true, status: true, total: true, amountPaid: true },
    });
    if (!invoice) actionError("Not found");

    const previousStatus = invoice.status;

    let amountPaid = invoice.amountPaid;
    if (status === "PAID") {
      amountPaid = invoice.total;
    } else if (status === "UNPAID" || status === "DRAFT" || status === "VOID") {
      amountPaid = 0;
    }

    await db.invoice.update({
      where: { id },
      data: { status, amountPaid },
    });

    await db.invoiceAudit.create({
      data: {
        invoiceId: id,
        orgId,
        action: "STATUS_CHANGE",
        fromStatus: previousStatus,
        toStatus: status,
        createdById: user.id,
      },
    });

    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${id}`);
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
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    if (!input.invoiceId) actionError("Invoice is required.");
    if (!input.amount || input.amount <= 0) actionError("Payment amount must be greater than zero.");

    const invoice = await db.invoice.findFirst({
      where: { id: input.invoiceId, orgId },
      select: { id: true, total: true, amountPaid: true, status: true },
    });
    if (!invoice) actionError("Invoice not found.");

    const remaining = invoice.total - invoice.amountPaid;
    if (input.amount > remaining + 0.01) {
      actionError(`Payment amount exceeds remaining balance of ${remaining.toFixed(2)}.`);
    }

    const newAmountPaid = Math.min(invoice.amountPaid + input.amount, invoice.total);

    await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: input.invoiceId,
          orgId,
          amount: input.amount,
          method: input.method ?? "OTHER",
          status: "COMPLETED",
          stripePaymentId: input.stripePaymentId,
          paypalTransactionId: input.paypalTransactionId,
          note: input.note,
        },
      });

      let newStatus = invoice.status;
      if (newAmountPaid >= invoice.total) {
        newStatus = "PAID";
      } else if (invoice.status === "PAID" || invoice.status === "VOID") {
        newStatus = "UNPAID";
      }

      await tx.invoice.update({
        where: { id: input.invoiceId },
        data: { amountPaid: newAmountPaid, status: newStatus },
      });

      await tx.invoiceAudit.create({
        data: {
          invoiceId: input.invoiceId,
          orgId,
          action: "PAYMENT_RECORDED",
          toStatus: newStatus,
          amount: input.amount,
          note: input.note,
          createdById: user.id,
        },
      });

      return payment;
    });

    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${input.invoiceId}`);
  });
}

export async function getInvoicePayments(invoiceId: string) {
  return withActionError("getInvoicePayments", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, orgId },
      select: { id: true },
    });
    if (!invoice) actionError("Not found");

    const payments = await db.payment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "desc" },
    });

    return payments;
  });
}

export async function getInvoiceAuditLogs(invoiceId: string) {
  return withActionError("getInvoiceAuditLogs", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, orgId: user.organizationId },
      select: { id: true },
    });
    if (!invoice) actionError("Not found");

    const logs = await db.invoiceAudit.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "desc" },
    });

    return logs;
  });
}

export async function createPaymentLink(input: {
  invoiceId: string;
  gateway: "stripe" | "paypal";
}) {
  return withActionError("createPaymentLink", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    const invoice = await db.invoice.findFirst({
      where: { id: input.invoiceId, orgId },
      include: { customer: true },
    });
    if (!invoice) actionError("Invoice not found.");
    if (invoice.status === "PAID" || invoice.status === "VOID") {
      actionError("Cannot create payment link for paid or void invoices.");
    }

    const remaining = invoice.total - invoice.amountPaid;
    if (remaining <= 0) {
      actionError("Invoice balance is already paid in full.");
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    let paymentUrl = "";

    if (input.gateway === "stripe") {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
        apiVersion: "2025-02-24.acacia",
        typescript: true,
      });

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: invoice.currency.toLowerCase(),
              product_data: {
                name: `Invoice ${invoice.number}`,
                description: `Payment for invoice ${invoice.number}`,
              },
              unit_amount: Math.round(remaining * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/dashboard/invoices/${invoice.id}?payment=success`,
        cancel_url: `${baseUrl}/dashboard/invoices/${invoice.id}?payment=cancelled`,
        metadata: { invoiceId: invoice.id, orgId },
      });

      paymentUrl = session.url || "";

      await db.invoiceAudit.create({
        data: {
          invoiceId: input.invoiceId,
          orgId,
          action: "PAYMENT_LINK_SENT",
          toStatus: invoice.status,
          note: `Stripe payment link created for ${formatCurrency(remaining, invoice.currency)}`,
          createdById: user.id,
        },
      });
    } else if (input.gateway === "paypal") {
      const paypalEmail = process.env.PAYPAL_BUSINESS_EMAIL;
      if (!paypalEmail) {
        actionError("PayPal is not configured. Set PAYPAL_BUSINESS_EMAIL.");
      }

      const itemName = encodeURIComponent(`Invoice ${invoice.number}`);
      const amountVal = remaining.toFixed(2);
      const currency = invoice.currency;
      const returnUrl = encodeURIComponent(`${baseUrl}/dashboard/invoices/${invoice.id}?payment=success`);
      const cancelUrl = encodeURIComponent(`${baseUrl}/dashboard/invoices/${invoice.id}?payment=cancelled`);

      paymentUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(paypalEmail)}&item_name=${itemName}&amount=${amountVal}&currency_code=${currency}&return=${returnUrl}&cancel_return=${cancelUrl}&invoice=${invoice.number}`;

      await db.invoiceAudit.create({
        data: {
          invoiceId: input.invoiceId,
          orgId,
          action: "PAYMENT_LINK_SENT",
          toStatus: invoice.status,
          note: `PayPal payment link created for ${formatCurrency(remaining, invoice.currency)}`,
          createdById: user.id,
        },
      });
    }

    return { url: paymentUrl, gateway: input.gateway };
  });
}

export async function getReminderConfig() {
  return withActionError("getReminderConfig", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    const config = await db.reminderConfig.findUnique({
      where: { orgId: user.organizationId },
    });

    return config;
  });
}

export async function saveReminderConfig(input: {
  enabled: boolean;
  remindBeforeDue: number;
  remindAfterDue: number;
  frequencyHours: number;
  maxReminders: number;
  emailSubject?: string;
  emailTemplate?: string;
}) {
  return withActionError("saveReminderConfig", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    const config = await db.reminderConfig.upsert({
      where: { orgId },
      update: {
        enabled: input.enabled,
        remindBeforeDue: input.remindBeforeDue,
        remindAfterDue: input.remindAfterDue,
        frequencyHours: input.frequencyHours,
        maxReminders: input.maxReminders,
        emailSubject: input.emailSubject,
        emailTemplate: input.emailTemplate,
      },
      create: {
        orgId,
        enabled: input.enabled,
        remindBeforeDue: input.remindBeforeDue,
        remindAfterDue: input.remindAfterDue,
        frequencyHours: input.frequencyHours,
        maxReminders: input.maxReminders,
        emailSubject: input.emailSubject,
        emailTemplate: input.emailTemplate,
      },
    });

    revalidatePath("/dashboard/settings/reminders");
    return config;
  });
}

export async function sendReminder(invoiceId: string) {
  return withActionError("sendReminder", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    const [invoice, config] = await Promise.all([
      db.invoice.findFirst({
        where: { id: invoiceId, orgId },
        include: { customer: true },
      }),
      db.reminderConfig.findUnique({ where: { orgId } }),
    ]);

    if (!invoice) actionError("Invoice not found.");
    if (!config?.enabled) actionError("Reminders are disabled for this organization.");

    const now = new Date();
    let type = "DUE_DATE";
    if (invoice.dueDate && now > invoice.dueDate) {
      type = "OVERDUE";
    }

    const recentReminders = await db.reminder.count({
      where: {
        invoiceId,
        status: "SENT",
        createdAt: { gte: new Date(now.getTime() - config.frequencyHours * 60 * 60 * 1000) },
      },
    });

    if (recentReminders >= config.maxReminders) {
      actionError(`Maximum number of reminders (${config.maxReminders}) reached for this invoice.`);
    }

    const reminder = await db.reminder.create({
      data: {
        orgId,
        invoiceId,
        type,
        scheduledAt: now,
        status: "SENT",
        channel: "EMAIL",
        note: `Reminder sent for invoice ${invoice.number}`,
      },
    });

    await db.invoiceAudit.create({
      data: {
        invoiceId,
        orgId,
        action: "REMINDER_SENT",
        toStatus: invoice.status,
        note: `Automated ${type} reminder sent`,
        createdById: user.id,
      },
    });

    revalidatePath(`/dashboard/invoices/${invoiceId}`);
    return reminder;
  });
}

export async function getReminders(input: { invoiceId?: string; status?: string }) {
  return withActionError("getReminders", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    const where: any = { orgId: user.organizationId };
    if (input.invoiceId) where.invoiceId = input.invoiceId;
    if (input.status) where.status = input.status;

    const reminders = await db.reminder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        invoice: {
          select: { number: true, status: true },
        },
      },
    });

    return reminders;
  });
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount || 0);
}

export async function deleteInvoice(id: string) {
  return withActionError("deleteInvoice", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    await db.invoice.deleteMany({ where: { id, orgId: user.organizationId } });
    revalidatePath("/dashboard/invoices");
  });
}
