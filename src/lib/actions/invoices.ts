"use server";

import { revalidatePath } from "next/cache";
import { db, withRetry } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { INVOICE_LIMITS } from "@/lib/plans";
import { withActionError, actionError } from "@/lib/action-errors";
import type { InvoiceType } from "@prisma/client";

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

export async function markInvoicePaid(id: string) {
  return withActionError("markInvoicePaid", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const invoice = await db.invoice.findFirst({
      where: { id, orgId: user.organizationId },
    });
    if (!invoice) actionError("Not found");
    await db.invoice.update({
      where: { id },
      data: { status: "PAID", amountPaid: invoice.total },
    });
    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${id}`);
  });
}

export async function deleteInvoice(id: string) {
  return withActionError("deleteInvoice", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    await db.invoice.deleteMany({ where: { id, orgId: user.organizationId } });
    revalidatePath("/dashboard/invoices");
  });
}
