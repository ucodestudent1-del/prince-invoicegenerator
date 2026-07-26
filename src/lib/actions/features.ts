"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import type { EstimateStatus, ExpenseCategory } from "@prisma/client";

// --------------------------- Estimates ---------------------------

export async function createEstimate(input: {
  customerId: string;
  projectId?: string | null;
  validUntil?: string | null;
  taxRate: number;
  discount: number;
  notes?: string;
  items: { description: string; quantity: number; unitPrice: number }[];
}) {
  const user = await requireUser();
  if (!user.organizationId) throw new Error("No organization");
  const orgId = user.organizationId;

  const subtotal = input.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
  const taxAmount = (subtotal * input.taxRate) / 100;
  const total = subtotal + taxAmount - input.discount;

  const count = await db.estimate.count({ where: { orgId } });
  const number = `EST-${String(count + 1).padStart(4, "0")}`;

  const estimate = await db.estimate.create({
    data: {
      orgId,
      number,
      customerId: input.customerId,
      projectId: input.projectId ?? null,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      taxRate: input.taxRate,
      discount: input.discount,
      subtotal,
      taxAmount,
      total,
      notes: input.notes,
      status: "DRAFT" as EstimateStatus,
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
  revalidatePath("/dashboard/estimates");
  return estimate;
}

// --------------------------- Change Orders ---------------------------

export async function createChangeOrder(input: {
  title: string;
  description?: string;
  projectId?: string | null;
  invoiceId?: string | null;
  amount: number;
}) {
  const user = await requireUser();
  if (!user.organizationId) throw new Error("No organization");
  const orgId = user.organizationId;
  const count = await db.changeOrder.count({ where: { orgId } });
  const number = `CO-${String(count + 1).padStart(4, "0")}`;
  const co = await db.changeOrder.create({
    data: {
      orgId,
      number,
      title: input.title,
      description: input.description,
      projectId: input.projectId ?? null,
      invoiceId: input.invoiceId ?? null,
      amount: input.amount,
    },
  });
  revalidatePath("/dashboard/change-orders");
  return co;
}

// --------------------------- Projects ---------------------------

export async function createProject(input: {
  name: string;
  customerId?: string | null;
  address?: string;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const user = await requireUser();
  if (!user.organizationId) throw new Error("No organization");
  const project = await db.project.create({
    data: {
      orgId: user.organizationId,
      name: input.name,
      customerId: input.customerId ?? null,
      address: input.address,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
    },
  });
  revalidatePath("/dashboard/projects");
  return project;
}

// --------------------------- Expenses ---------------------------

export async function createExpense(input: {
  vendor?: string;
  category: ExpenseCategory;
  amount: number;
  date?: string | null;
  notes?: string;
  projectId?: string | null;
  photoId?: string | null;
}) {
  const user = await requireUser();
  if (!user.organizationId) throw new Error("No organization");
  const expense = await db.expense.create({
    data: {
      orgId: user.organizationId,
      vendor: input.vendor,
      category: input.category,
      amount: input.amount,
      date: input.date ? new Date(input.date) : new Date(),
      notes: input.notes,
      projectId: input.projectId ?? null,
      photoId: input.photoId ?? null,
    },
  });
  revalidatePath("/dashboard/expenses");
  return expense;
}

// --------------------------- Subcontractors ---------------------------

export async function createSubcontractor(input: {
  name: string;
  company?: string;
  trade?: string;
  email?: string;
  phone?: string;
  rate?: number;
}) {
  const user = await requireUser();
  if (!user.organizationId) throw new Error("No organization");
  const sub = await db.subcontractor.create({
    data: {
      orgId: user.organizationId,
      name: input.name,
      company: input.company,
      trade: input.trade,
      email: input.email,
      phone: input.phone,
      rate: input.rate,
    },
  });
  revalidatePath("/dashboard/subcontractors");
  return sub;
}
