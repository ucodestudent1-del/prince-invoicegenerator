"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { getNextEstimateNumber, getNextChangeOrderNumber } from "@/lib/numbering";
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
  return withActionError("createEstimate", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    const validItems = input.items.filter(
      (it) => it.description && it.quantity > 0 && it.unitPrice > 0
    );
    if (validItems.length === 0) {
      actionError("At least one line item is required.");
    }

    const subtotal = validItems.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
    const taxAmount = (subtotal * input.taxRate) / 100;
    const total = subtotal + taxAmount - input.discount;

    const number = await getNextEstimateNumber(db, orgId);

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
    revalidatePath("/dashboard/estimates");
    return estimate;
  });
}

// --------------------------- Change Orders ---------------------------

export async function createChangeOrder(input: {
  title: string;
  description?: string;
  projectId?: string | null;
  invoiceId?: string | null;
  amount: number;
}) {
  return withActionError("createChangeOrder", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    if (!input.title) actionError("Title is required.");

    const number = await getNextChangeOrderNumber(db, orgId);
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
  });
}

// --------------------------- Projects ---------------------------

export async function createProject(input: {
  name: string;
  customerId?: string | null;
  address?: string;
  startDate?: string | null;
  endDate?: string | null;
}) {
  return withActionError("createProject", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    if (!input.name) actionError("Name is required.");

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
  });
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
  return withActionError("createExpense", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
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
  });
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
  return withActionError("createSubcontractor", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    if (!input.name) actionError("Name is required.");

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
  });
}
