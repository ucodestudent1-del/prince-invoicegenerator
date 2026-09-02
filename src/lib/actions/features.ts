"use server";

import { db } from "@/lib/db";
import { requireUser, getActivePlan } from "@/lib/org";
import { isMissingColumnError } from "@/lib/db-drift";
import { withActionError, actionError } from "@/lib/action-errors";
import { getNextEstimateNumber, getNextChangeOrderNumber } from "@/lib/numbering";
import { revalidateWithLocale } from "@/lib/revalidate";
import { coerceEnum } from "@/lib/utils";
import { hasFeature } from "@/lib/plans";
import { ExpenseCategory, type EstimateStatus } from "@prisma/client";
import { logServerError } from "@/lib/errors";

// --------------------------- Estimates ---------------------------

export async function createEstimate(input: {
  customerId: string;
  projectId?: string | null;
  validUntil?: string | null;
  taxRate: number;
  discount: number;
  notes?: string;
  items: { description: string; quantity: number; unitPrice: number; sku?: string | null }[];
}) {
  return withActionError("createEstimate", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];
    const plan = await getActivePlan(user);
    if (!hasFeature(plan, "estimates")) actionError("Estimates require a paid plan.");

    if (!input["customerId"]) actionError("Customer is required.");
    const customerExists = await db["customer"]["findFirst"]({
      where: { id: input["customerId"], orgId },
      select: { id: true },
    });
    if (!customerExists) {
      actionError("Selected customer does not exist or has been deleted.");
    }

    if (input["projectId"]) {
      const projectExists = await db["project"]["findFirst"]({
        where: { id: input["projectId"]!, orgId },
        select: { id: true },
      });
      if (!projectExists) {
        // Soft-fail: a stale projectId (project deleted since the form
        // rendered) shouldn't block creating the estimate.
        logServerError("createEstimate: missing project", {
          projectId: input["projectId"],
          orgId,
        });
        input["projectId"] = null;
      }
    }

    const validItems = input["items"]["filter"](
      (it) => it["description"] && it["quantity"] > 0 && it["unitPrice"] > 0
    );
    if (validItems["length"] === 0) {
      actionError("At least one line item is required.");
    }

    const subtotal = validItems["reduce"]((a, i) => a + i["quantity"] * i["unitPrice"], 0);
    const taxAmount = (subtotal * input["taxRate"]) / 100;
    const total = subtotal + taxAmount - input["discount"];

    const number = await getNextEstimateNumber(db, orgId);

    let estimate;
    try {
      estimate = await db["estimate"]["create"]({
        data: {
          orgId,
          number,
          customerId: input["customerId"],
          projectId: input["projectId"] ?? null,
          validUntil: input["validUntil"] ? new Date(input["validUntil"]) : null,
          taxRate: input["taxRate"],
          discount: input["discount"],
          subtotal,
          taxAmount,
          total,
          notes: input["notes"],
          status: "DRAFT" as EstimateStatus,
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
    } catch (err) {
      if (isMissingColumnError(err)) {
        estimate = await db["estimate"]["create"]({
          data: {
            orgId,
            number,
            customerId: input["customerId"],
            projectId: input["projectId"] ?? null,
            validUntil: input["validUntil"] ? new Date(input["validUntil"]) : null,
            taxRate: input["taxRate"],
            discount: input["discount"],
            subtotal,
            taxAmount,
            total,
            notes: input["notes"],
            status: "DRAFT" as EstimateStatus,
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
          select: {
            id: true,
            number: true,
            customerId: true,
            status: true,
            total: true,
          },
        });
      } else {
        throw err;
      }
    }
    await revalidateWithLocale("/dashboard/estimates");
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
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];
    const plan = await getActivePlan(user);
    if (!hasFeature(plan, "changeOrders")) actionError("Change orders require a paid plan.");

    if (!input["title"]) actionError("Title is required.");

    if (input["projectId"]) {
      const projectExists = await db["project"]["findFirst"]({
        where: { id: input["projectId"]!, orgId },
        select: { id: true },
      });
      if (!projectExists) {
        // Soft-fail: a stale projectId (project deleted since the form
        // rendered) shouldn't block creating the change order.
        logServerError("createChangeOrder: missing project", {
          projectId: input["projectId"],
          orgId,
        });
        input["projectId"] = null;
      }
    }

    if (input["invoiceId"]) {
      const invoiceExists = await db["invoice"]["findFirst"]({
        where: { id: input["invoiceId"]!, orgId },
        select: { id: true },
      });
      if (!invoiceExists) {
        // Soft-fail: stale invoiceId should not block the change order.
        logServerError("createChangeOrder: missing invoice", {
          invoiceId: input["invoiceId"],
          orgId,
        });
        input["invoiceId"] = null;
      }
    }

     const number = await getNextChangeOrderNumber(db, orgId);
    const co = await db["changeOrder"]["create"]({
      data: {
        orgId,
        number,
        title: input["title"],
        description: input["description"],
        projectId: input["projectId"] ?? null,
        invoiceId: input["invoiceId"] ?? null,
        amount: input["amount"],
        changeAmount: input["amount"],
        revisedTotal: input["amount"],
      },
    });
    await revalidateWithLocale("/dashboard/change-orders");
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
    if (!user["organizationId"]) actionError("No organization");
    const plan = await getActivePlan(user);
    if (!hasFeature(plan, "projectManagement")) actionError("Project management requires a paid plan.");

    if (!input["name"]) actionError("Name is required.");

    const project = await db["project"]["create"]({
      data: {
        orgId: user["organizationId"],
        name: input["name"],
        customerId: input["customerId"] ?? null,
        address: input["address"],
        startDate: input["startDate"] ? new Date(input["startDate"]) : null,
        endDate: input["endDate"] ? new Date(input["endDate"]) : null,
      },
    });
    await revalidateWithLocale("/dashboard/projects");
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
    if (!user["organizationId"]) actionError("No organization");
    const plan = await getActivePlan(user);
    if (!hasFeature(plan, "expenseTracking")) actionError("Expense tracking requires a paid plan.");
    const expense = await db["expense"]["create"]({
      data: {
        orgId: user["organizationId"],
        vendor: input["vendor"],
        category: coerceEnum(input["category"], ExpenseCategory, "category"),
        amount: input["amount"],
        date: input["date"] ? new Date(input["date"]) : new Date(),
        notes: input["notes"],
        projectId: input["projectId"] ?? null,
        photoId: input["photoId"] ?? null,
      },
    });
    await revalidateWithLocale("/dashboard/expenses");
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
    if (!user["organizationId"]) actionError("No organization");
    const plan = await getActivePlan(user);
    if (!hasFeature(plan, "subcontractorTracking")) actionError("Subcontractor tracking requires a paid plan.");

    if (!input["name"]) actionError("Name is required.");

    const sub = await db["subcontractor"]["create"]({
      data: {
        orgId: user["organizationId"],
        name: input["name"],
        company: input["company"],
        trade: input["trade"],
        email: input["email"],
        phone: input["phone"],
        rate: input["rate"],
      },
    });
    await revalidateWithLocale("/dashboard/subcontractors");
    return sub;
  });
}
