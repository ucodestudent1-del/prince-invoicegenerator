"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { isMissingColumnError } from "@/lib/db-drift";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidateWithLocale } from "@/lib/revalidate";
import { logServerError } from "@/lib/errors";
import { computeProjectFinancials } from "@/lib/project-financials";
import { roundMoney } from "@/lib/money";
import type { ExpenseCategory } from "@prisma/client";

export interface UpdateProjectInput {
  name?: string;
  number?: string;
  address?: string | null;
  customerId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  estCompletionDate?: string | null;
  contractValue?: number;
  paymentTerms?: string;
  taxRate?: number;
  retainageRate?: number;
  depositRequired?: number;
  depositPaid?: number;
  projectManager?: string | null;
  status?: string;
}

export interface GetProjectInvoicesOpts {
  skip?: number;
  take?: number;
}

export interface GetProjectExpensesOpts {
  skip?: number;
  take?: number;
}

// Fallback select for projects when new columns don't exist yet (schema drift)
const PROJECT_BASE_SELECT_OLD = {
  id: true,
  name: true,
  number: true,
  address: true,
  startDate: true,
  endDate: true,
  status: true,
  customerId: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, name: true, company: true, email: true, address: true } },
};

const PROJECT_BASE_SELECT_NEW = {
  ...PROJECT_BASE_SELECT_OLD,
  estCompletionDate: true,
  contractValue: true,
  paymentTerms: true,
  taxRate: true,
  retainageRate: true,
  depositRequired: true,
  depositPaid: true,
  projectManager: true,
};

export async function getProjectDetail(projectId: string) {
  return withActionError("getProjectDetail", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    let project;
    try {
      project = await db["project"]["findFirst"]({
        where: { id: projectId, orgId },
        include: { customer: true },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        project = await db["project"]["findFirst"]({
          where: { id: projectId, orgId },
          select: PROJECT_BASE_SELECT_OLD,
        });
      } else {
        throw err;
      }
    }
    if (!project) actionError("Project not found");

    return project;
  });
}

export async function getProjectFinancials(projectId: string) {
  return withActionError("getProjectFinancials", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

     let project;
    try {
      project = await db["project"]["findFirst"]({
        where: { id: projectId, orgId },
        select: {
          contractValue: true,
          depositPaid: true,
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        project = await db["project"]["findFirst"]({
          where: { id: projectId, orgId },
          select: { id: true },
        });
      } else {
        throw err;
      }
    }
    if (!project) actionError("Project not found");

    const p = project as any;
    const contractValue = Number(p["contractValue"] ?? 0);
    const depositPaid = Number(p["depositPaid"] ?? 0);

    // Fetch invoices for this project
    let invoices: { total: number; amountPaid: number; status: string; currency?: string }[] = [];
    try {
      invoices = await db["invoice"]["findMany"]({
        where: { orgId, projectId },
        select: { total: true, amountPaid: true, status: true, currency: true },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        invoices = [];
      } else {
        throw err;
      }
    }

    let payments: { amount: number }[] = [];
    try {
      payments = await db["payment"]["findMany"]({
        where: { orgId, invoice: { projectId: projectId } },
        select: { amount: true },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        payments = [];
      } else {
        throw err;
      }
    }

    // Fetch expenses
    let expenses: { amount: number }[] = [];
    try {
      expenses = await db["expense"]["findMany"]({
        where: { orgId, projectId },
        select: { amount: true },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        expenses = [];
      } else {
        throw err;
      }
    }

    // Fetch change orders
    let changeOrders: { changeAmount: number; status: string }[] = [];
    try {
      changeOrders = await db["changeOrder"]["findMany"]({
        where: { orgId, projectId },
        select: { changeAmount: true, status: true },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        changeOrders = [];
      } else {
        throw err;
      }
    }

    const financials = computeProjectFinancials({
      originalContractValue: contractValue,
      depositPaid,
      currency: invoices[0]?.["currency"] ?? "USD",
      invoices: invoices["map"]((i) => ({
        total: Number(i["total"] ?? 0),
        amountPaid: Number(i["amountPaid"] ?? 0),
        status: i["status"] ?? "DRAFT",
      })),
      payments: payments["map"]((p) => ({ amount: Number(p["amount"] ?? 0) })),
      expenses: expenses["map"]((e) => ({ amount: Number(e["amount"] ?? 0) })),
      changeOrders: changeOrders["map"]((co) => ({
        changeAmount: Number(co["changeAmount"] ?? 0),
        status: co["status"] ?? "DRAFT",
      })),
    });

    return financials;
  });
}

export async function getProjectInvoices(projectId: string, opts?: GetProjectInvoicesOpts) {
  return withActionError("getProjectInvoices", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const skip = opts?.["skip"] ?? 0;
    const take = opts?.["take"] ?? 50;

    let invoices;
    try {
      invoices = await db["invoice"]["findMany"]({
        where: { orgId, projectId },
        orderBy: { issueDate: "desc" },
        include: { customer: true },
        skip,
        take,
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        invoices = await db["invoice"]["findMany"]({
          where: { orgId, projectId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            number: true,
            status: true,
            issueDate: true,
            dueDate: true,
            currency: true,
            total: true,
            amountPaid: true,
            createdAt: true,
            updatedAt: true,
            customerId: true,
            customer: { select: { id: true, name: true, company: true } },
          },
          skip,
          take,
        });
      } else {
        throw err;
      }
    }
    return invoices;
  });
}

export async function getProjectPayments(projectId: string, opts?: GetProjectInvoicesOpts) {
  return withActionError("getProjectPayments", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const skip = opts?.["skip"] ?? 0;
    const take = opts?.["take"] ?? 50;

    let payments: any[] = [];
    try {
      payments = await db["payment"]["findMany"]({
        where: {
          orgId,
          invoice: { projectId: projectId },
        },
        orderBy: { createdAt: "desc" },
        include: {
          invoice: {
            select: { id: true, number: true, status: true, total: true },
          },
        },
        skip,
        take,
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        try {
        payments = await db["payment"]["findMany"]({
            where: {
              orgId,
              invoice: { projectId: projectId },
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              amount: true,
              method: true,
              reference: true,
              status: true,
              createdAt: true,
              updatedAt: true,
              invoiceId: true,
              invoice: {
                select: { id: true, number: true },
              },
            },
            skip,
            take,
          });
        } catch (innerErr) {
          if (isMissingColumnError(innerErr)) {
            payments = [];
          } else {
            throw innerErr;
          }
        }
      } else {
        throw err;
      }
    }
    return payments;
  });
}

export async function getProjectExpenses(projectId: string, opts?: GetProjectExpensesOpts) {
  return withActionError("getProjectExpenses", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const skip = opts?.["skip"] ?? 0;
    const take = opts?.["take"] ?? 50;

    let expenses: any[] = [];
    try {
      expenses = await db["expense"]["findMany"]({
        where: { orgId, projectId },
        orderBy: { date: "desc" },
        include: { project: true },
        skip,
        take,
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        expenses = await db["expense"]["findMany"]({
          where: { orgId, projectId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            vendor: true,
            category: true,
            amount: true,
            date: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
          },
          skip,
          take,
        });
      } else {
        throw err;
      }
    }
    return expenses;
  });
}

export async function getProjectChangeOrders(projectId: string) {
  return withActionError("getProjectChangeOrders", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    let changeOrders: any[] = [];
    try {
      changeOrders = await db["changeOrder"]["findMany"]({
        where: { orgId, projectId },
        orderBy: { createdAt: "desc" },
        include: { customer: true },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        changeOrders = await db["changeOrder"]["findMany"]({
          where: { orgId, projectId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            number: true,
            title: true,
            description: true,
            amount: true,
            changeAmount: true,
            originalTotal: true,
            revisedTotal: true,
            status: true,
            issueDate: true,
            createdAt: true,
            updatedAt: true,
            customerId: true,
            customer: { select: { id: true, name: true, company: true } },
          },
        });
      } else {
        throw err;
      }
    }
    return changeOrders;
  });
}

export async function updateProject(projectId: string, input: UpdateProjectInput) {
  return withActionError("updateProject", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const project = await db["project"]["findFirst"]({
      where: { id: projectId, orgId },
      select: { id: true },
    });
    if (!project) actionError("Project not found");

    const updates: Record<string, unknown> = {};
    if (input["name"] !== undefined) updates["name"] = input["name"];
    if (input["number"] !== undefined) updates["number"] = input["number"];
    if (input["address"] !== undefined) updates["address"] = input["address"];
    if (input["customerId"] !== undefined) updates["customerId"] = input["customerId"];
    if (input["startDate"] !== undefined) {
      updates["startDate"] = input["startDate"] ? new Date(input["startDate"]) : null;
    }
    if (input["endDate"] !== undefined) {
      updates["endDate"] = input["endDate"] ? new Date(input["endDate"]) : null;
    }
    if (input["estCompletionDate"] !== undefined) {
      updates["estCompletionDate"] = input["estCompletionDate"]
        ? new Date(input["estCompletionDate"])
        : null;
    }
    if (input["contractValue"] !== undefined) updates["contractValue"] = roundMoney(input["contractValue"]);
    if (input["paymentTerms"] !== undefined) updates["paymentTerms"] = input["paymentTerms"];
    if (input["taxRate"] !== undefined) updates["taxRate"] = input["taxRate"];
    if (input["retainageRate"] !== undefined) updates["retainageRate"] = input["retainageRate"];
    if (input["depositRequired"] !== undefined) updates["depositRequired"] = roundMoney(input["depositRequired"]);
    if (input["depositPaid"] !== undefined) updates["depositPaid"] = roundMoney(input["depositPaid"]);
    if (input["projectManager"] !== undefined) updates["projectManager"] = input["projectManager"];
    if (input["status"] !== undefined) updates["status"] = input["status"];

    // Try with new fields first; fall back to old schema if columns missing
    try {
      await db["project"]["update"]({
        where: { id: projectId, orgId },
        data: updates,
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        // Retry with only the original columns
        const safeUpdates: Record<string, unknown> = {};
        if (input["name"] !== undefined) safeUpdates["name"] = input["name"];
        if (input["number"] !== undefined) safeUpdates["number"] = input["number"];
        if (input["address"] !== undefined) safeUpdates["address"] = input["address"];
        if (input["customerId"] !== undefined) safeUpdates["customerId"] = input["customerId"];
        if (input["startDate"] !== undefined) {
          safeUpdates["startDate"] = input["startDate"] ? new Date(input["startDate"]) : null;
        }
        if (input["endDate"] !== undefined) {
          safeUpdates["endDate"] = input["endDate"] ? new Date(input["endDate"]) : null;
        }
        if (input["status"] !== undefined) safeUpdates["status"] = input["status"];
        await db["project"]["update"]({
          where: { id: projectId, orgId },
          data: safeUpdates,
        });
      } else {
        throw err;
      }
    }

    await revalidateWithLocale(`/dashboard/projects/${projectId}`);
    await revalidateWithLocale("/dashboard/projects");
    return { success: true };
  });
}
