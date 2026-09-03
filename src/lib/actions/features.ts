"use server";

import { db } from "@/lib/db";
import { requireUser, getActivePlan } from "@/lib/org";
import { isMissingColumnError } from "@/lib/db-drift";
import { withActionError, actionError } from "@/lib/action-errors";
import { getNextEstimateNumber, getNextChangeOrderNumber, getNextProjectNumber } from "@/lib/numbering";
import { revalidateWithLocale } from "@/lib/revalidate";
import { coerceEnum } from "@/lib/utils";
import { hasFeature } from "@/lib/plans";
import { ExpenseCategory, type EstimateStatus } from "@prisma/client";
import { logServerError } from "@/lib/errors";
import { roundMoney } from "@/lib/money";
import { computeEstimateTotals } from "@/lib/estimate-totals";

// --------------------------- Estimates ---------------------------

export async function createEstimate(input: {
   customerId: string;
   projectId?: string | null;
   title?: string;
   issueDate?: string | null;
   billToAddress?: string | null;
   validUntil?: string | null;
   taxRate: number;
   discount: number;
   notes?: string;
   termsAndConditions?: string;
   items: { description: string; quantity: number; unitPrice: number; unit?: string; sku?: string | null }[];
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

    const totals = computeEstimateTotals({
      items: validItems["map"]((i) => ({ quantity: i["quantity"], unitPrice: i["unitPrice"] })),
      discountType: input["discount"] > 0 ? "FIXED" : undefined,
      discountValue: input["discount"] > 0 ? input["discount"] : undefined,
      taxRate: input["taxRate"],
    });
    const subtotal = totals["subtotal"];
    const taxAmount = totals["taxTotal"];
    const total = totals["total"];

    const number = await getNextEstimateNumber(db, orgId);

    let estimate;
    try {
       estimate = await db["estimate"]["create"]({
         data: {
           orgId,
           number,
           title: input["title"],
           customerId: input["customerId"],
           projectId: input["projectId"] ?? null,
           issueDate: input["issueDate"] ? new Date(input["issueDate"]) : undefined,
           billToAddress: input["billToAddress"],
           validUntil: input["validUntil"] ? new Date(input["validUntil"]) : null,
           taxRate: input["taxRate"],
           discount: input["discount"],
           subtotal,
           taxAmount,
           total,
           notes: input["notes"],
           termsAndConditions: input["termsAndConditions"],
           status: "DRAFT" as EstimateStatus,
           items: {
             create: validItems["map"]((it, i) => ({
               description: it["description"],
               quantity: it["quantity"],
                unit: it["unit"] || "units",
                unitPrice: it["unitPrice"],
                amount: roundMoney(it["quantity"] * it["unitPrice"]),
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
                  amount: roundMoney(it["quantity"] * it["unitPrice"]),
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
   customerId?: string | null;
   amount: number;
   originalTotal?: number;
   daysAdded?: number | null;
   originalCompletionDate?: string | null;
   newCompletionDate?: string | null;
   billToAddress?: string | null;
   scopeChangeDescription?: string;
   scheduleImpactDescription?: string;
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
         logServerError("createChangeOrder: missing invoice", {
           invoiceId: input["invoiceId"],
           orgId,
         });
         input["invoiceId"] = null;
       }
     }

     if (input["customerId"]) {
       const customerExists = await db["customer"]["findFirst"]({
         where: { id: input["customerId"]!, orgId },
         select: { id: true },
       });
       if (!customerExists) {
         logServerError("createChangeOrder: missing customer", {
           customerId: input["customerId"],
           orgId,
         });
         input["customerId"] = null;
       }
     }

      const number = await getNextChangeOrderNumber(db, orgId);
      const originalTotal = input["originalTotal"] ?? 0;
      const changeAmount = input["amount"];
      const revisedTotal = originalTotal + changeAmount;

      let co;
      try {
        co = await db["changeOrder"]["create"]({
          data: {
            orgId,
            number,
            title: input["title"],
            description: input["description"],
            projectId: input["projectId"] ?? null,
            invoiceId: input["invoiceId"] ?? null,
            customerId: input["customerId"] ?? null,
            amount: input["amount"],
            changeAmount,
            revisedTotal,
            originalTotal,
            daysAdded: input["daysAdded"] ?? null,
            originalCompletionDate: input["originalCompletionDate"] ? new Date(input["originalCompletionDate"]) : null,
            newCompletionDate: input["newCompletionDate"] ? new Date(input["newCompletionDate"]) : null,
            billToAddress: input["billToAddress"] ?? null,
            scopeChangeDescription: input["scopeChangeDescription"],
            scheduleImpactDescription: input["scheduleImpactDescription"],
          },
        });
      } catch (err) {
        if (isMissingColumnError(err)) {
          co = await db["changeOrder"]["create"]({
            data: {
              orgId,
              number,
              title: input["title"],
              description: input["description"],
              projectId: input["projectId"] ?? null,
              invoiceId: input["invoiceId"] ?? null,
              amount: input["amount"],
            },
          });
        } else {
          throw err;
        }
      }
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
  estCompletionDate?: string | null;
  contractValue?: number;
  paymentTerms?: string;
  taxRate?: number;
  retainageRate?: number;
  depositRequired?: number;
  projectManager?: string;
}) {
  return withActionError("createProject", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];
    const plan = await getActivePlan(user);
    if (!hasFeature(plan, "projectManagement")) actionError("Project management requires a paid plan.");

    if (!input["name"]) actionError("Name is required.");

    const number = await getNextProjectNumber(db, orgId);

    const project = await db["project"]["create"]({
      data: {
        orgId: user["organizationId"],
        name: input["name"],
        number,
        customerId: input["customerId"] ?? null,
        address: input["address"],
        startDate: input["startDate"] ? new Date(input["startDate"]) : null,
        endDate: input["endDate"] ? new Date(input["endDate"]) : null,
        estCompletionDate: input["estCompletionDate"] ? new Date(input["estCompletionDate"]) : null,
        contractValue: input["contractValue"] ?? 0,
        paymentTerms: input["paymentTerms"] ?? "NET_30",
        taxRate: input["taxRate"] ?? 0,
        retainageRate: input["retainageRate"] ?? 0,
        depositRequired: input["depositRequired"] ?? 0,
        projectManager: input["projectManager"] ?? null,
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
