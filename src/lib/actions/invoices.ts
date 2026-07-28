"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, getCurrentOrg } from "@/lib/org";
import { INVOICE_LIMITS } from "@/lib/plans";
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
  items: InvoiceItemInput[];
}

export async function createInvoice(input: CreateInvoiceInput) {
  const user = await requireUser();
  if (!user.organizationId) throw new Error("No organization");
  const orgId = user.organizationId;

  // Enforce FREE plan monthly invoice limit.
  const limit = INVOICE_LIMITS.FREE;
  if (limit !== null) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const count = await db.invoice.count({
      where: { orgId, createdAt: { gte: startOfMonth } },
    });
    if (count >= limit) {
      throw new Error(
        `Your Free plan is limited to ${limit} invoices per month. Upgrade to create more.`
      );
    }
  }

  const subtotal = input.items.reduce(
    (acc, it) => acc + it.quantity * it.unitPrice,
    0
  );
  const taxAmount = (subtotal * input.taxRate) / 100;
  const total = subtotal + taxAmount - input.discount;
  const retainageAmount = (total * input.retainageRate) / 100;

  const count = await db.invoice.count({ where: { orgId } });
  const number = `INV-${String(count + 1).padStart(4, "0")}`;

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
      createdById: user.id,
      items: {
        create: input.items.map((it, i) => ({
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
}

export async function markInvoicePaid(id: string) {
  const user = await requireUser();
  if (!user.organizationId) throw new Error("No organization");
  const invoice = await db.invoice.findFirst({
    where: { id, orgId: user.organizationId },
  });
  if (!invoice) throw new Error("Not found");
  await db.invoice.update({
    where: { id },
    data: { status: "PAID", amountPaid: invoice.total },
  });
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${id}`);
}

export async function deleteInvoice(id: string) {
  const user = await requireUser();
  if (!user.organizationId) throw new Error("No organization");
  await db.invoice.deleteMany({ where: { id, orgId: user.organizationId } });
  revalidatePath("/dashboard/invoices");
}
