"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { isMissingColumnError, isMissingTableError } from "@/lib/db-drift";
import { logWarn } from "@/lib/logging";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidateWithLocale } from "@/lib/revalidate";
import { CustomerStatus } from "@prisma/client";
import { coerceEnum } from "@/lib/utils";

export interface CreateCustomerInput {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxId?: string | null;
  notes?: string | null;
}

export interface UpdateCustomerInput extends Partial<CreateCustomerInput> {
  status?: CustomerStatus;
  portalAccess?: boolean;
  portalPin?: string | null;
  address?: string | null;
}

function recalculateCustomerFinancials(customerId: string, orgId: string) {
  return db["$transaction"](async (tx) => {
    const invoices = await tx["invoice"]["findMany"]({
      where: { customerId, orgId },
      select: { total: true, amountPaid: true },
    });

    const totalInvoiced = invoices["reduce"]((sum, inv) => sum + inv["total"], 0);
    const totalPaid = invoices["reduce"]((sum, inv) => sum + inv["amountPaid"], 0);
    const outstandingBalance = totalInvoiced - totalPaid;

    await tx["customer"]["update"]({
      where: { id: customerId, orgId },
      data: { totalInvoiced, totalPaid, outstandingBalance },
    });

    return { totalInvoiced, totalPaid, outstandingBalance };
  });
}

export async function recalculateAllCustomerFinancials() {
  return withActionError("recalculateAllCustomerFinancials", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const customers = await db["customer"]["findMany"]({
      where: { orgId },
      select: { id: true },
    });

    for (const customer of customers) {
      await recalculateCustomerFinancials(customer["id"], orgId);
    }

    await revalidateWithLocale("/dashboard/customers");
    return { success: true, count: customers["length"] };
  });
}

export async function getCustomers(params?: {
  search?: string;
  status?: CustomerStatus | "ALL";
  limit?: number;
}) {
  return withActionError("getCustomers", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const where: Record<string, any> = { orgId };
    if (params?.["search"]) {
      where["OR"] = [
        { name: { contains: params["search"], mode: "insensitive" } },
        { company: { contains: params["search"], mode: "insensitive" } },
        { email: { contains: params["search"], mode: "insensitive" } },
      ];
    }
    if (params?.["status"] && params["status"] !== "ALL") {
      where["status"] = coerceEnum(params["status"], CustomerStatus, "status");
    }

    try {
      const customers = await db["customer"]["findMany"]({
        where,
        orderBy: { name: "asc" },
        take: params?.["limit"] ?? undefined,
      });
      return customers;
    } catch (err) {
      if (isMissingColumnError(err)) {
        // Fallback without new columns
        return await db["customer"]["findMany"]({
          where: { orgId },
          orderBy: { name: "asc" },
          take: params?.["limit"] ?? undefined,
        });
      }
      throw err;
    }
  });
}

export async function getCustomerDetail(id: string) {
  return withActionError("getCustomerDetail", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    try {
      const customer = await db["customer"]["findFirst"]({
        where: { id, orgId },
        include: {
          invoices: {
            orderBy: { createdAt: "desc" },
            take: 50,
            include: { payments: { orderBy: { createdAt: "desc" } } },
          },
          estimates: { orderBy: { createdAt: "desc" }, take: 50 },
          addresses: { where: { isDefault: true }, take: 1 },
        },
      });
      if (!customer) actionError("Customer not found");
      return customer;
    } catch (err) {
      if (isMissingColumnError(err)) {
        const customer = await db["customer"]["findFirst"]({
          where: { id, orgId },
          include: {
            invoices: { orderBy: { createdAt: "desc" }, take: 50 },
            estimates: { orderBy: { createdAt: "desc" }, take: 50 },
          },
        });
        if (!customer) actionError("Customer not found");
        return customer;
      }
      throw err;
    }
  });
}

export async function createCustomer(input: CreateCustomerInput) {
  return withActionError("createCustomer", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    if (!input["name"] || input["name"]["trim"]() === "") {
      actionError("Customer name is required.");
    }

    let customer;
    try {
      customer = await db["customer"]["create"]({
        data: {
          orgId,
          name: input["name"],
          company: input["company"] || null,
          email: input["email"] || null,
          phone: input["phone"] || null,
          website: input["website"] || null,
          taxId: input["taxId"] || null,
          notes: input["notes"] || null,
        },
      });
    } catch (err) {
      if (err instanceof Error && err["message"]["includes"]("Unique constraint failed")) {
        actionError("A customer with this email already exists.");
      }
      if (isMissingColumnError(err)) {
        customer = await db["customer"]["create"]({
          data: {
            orgId,
            name: input["name"],
            company: input["company"] || null,
            email: input["email"] || null,
            phone: input["phone"] || null,
            notes: input["notes"] || null,
          },
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            phone: true,
            address: true,
            notes: true,
            createdAt: true,
          },
        });
      } else {
        throw err;
      }
    }

    await revalidateWithLocale("/dashboard/customers");
    return customer;
  });
}

export async function updateCustomer(id: string, input: UpdateCustomerInput) {
  return withActionError("updateCustomer", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const existing = await db["customer"]["findFirst"]({
      where: { id, orgId },
      select: { id: true },
    });
    if (!existing) actionError("Customer not found");

    const data: Record<string, any> = {};
    if (input["name"] !== undefined) data["name"] = input["name"];
    if (input["company"] !== undefined) data["company"] = input["company"];
    if (input["email"] !== undefined) data["email"] = input["email"];
    if (input["phone"] !== undefined) data["phone"] = input["phone"];
    if (input["website"] !== undefined) data["website"] = input["website"];
    if (input["taxId"] !== undefined) data["taxId"] = input["taxId"];
    if (input["notes"] !== undefined) data["notes"] = input["notes"];
    if (input["address"] !== undefined) data["address"] = input["address"] || null;
    if (input["status"] !== undefined) data["status"] = coerceEnum(input["status"], CustomerStatus, "status");
    if (input["portalAccess"] !== undefined) data["portalAccess"] = input["portalAccess"];
    if (input["portalPin"] !== undefined) data["portalPin"] = input["portalPin"];

    try {
      const customer = await db["customer"]["update"]({
        where: { id, orgId },
        data,
      });

      await revalidateWithLocale("/dashboard/customers");
      await revalidateWithLocale(`/dashboard/customers/${id}`);
      return customer;
    } catch (err) {
      if (isMissingColumnError(err)) {
        const safeData = { ...data };
        delete safeData["status"];
        delete safeData["website"];
        delete safeData["taxId"];
        delete safeData["portalAccess"];
        delete safeData["portalPin"];
        delete safeData["archivedAt"];
        const customer = await db["customer"]["update"]({
          where: { id, orgId },
          data: safeData,
        });
        await revalidateWithLocale("/dashboard/customers");
        await revalidateWithLocale(`/dashboard/customers/${id}`);
        return customer;
      }
      throw err;
    }
  });
}

export async function archiveCustomer(id: string) {
  return withActionError("archiveCustomer", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const existing = await db["customer"]["findFirst"]({
      where: { id, orgId },
      select: { id: true },
    });
    if (!existing) actionError("Customer not found");

    try {
      const customer = await db["customer"]["update"]({
        where: { id, orgId },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
        },
      });

      await revalidateWithLocale("/dashboard/customers");
      await revalidateWithLocale(`/dashboard/customers/${id}`);
      return customer;
    } catch (err) {
      if (isMissingColumnError(err)) {
        await db["customer"]["update"]({
          where: { id, orgId },
          data: {},
        });
        await revalidateWithLocale("/dashboard/customers");
        await revalidateWithLocale(`/dashboard/customers/${id}`);
        return existing;
      }
      throw err;
    }
  });
}

export async function unarchiveCustomer(id: string) {
  return withActionError("unarchiveCustomer", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const existing = await db["customer"]["findFirst"]({
      where: { id, orgId },
      select: { id: true },
    });
    if (!existing) actionError("Customer not found");

    try {
      const customer = await db["customer"]["update"]({
        where: { id, orgId },
        data: {
          status: "ACTIVE",
          archivedAt: null,
        },
      });

      await revalidateWithLocale("/dashboard/customers");
      await revalidateWithLocale(`/dashboard/customers/${id}`);
      return customer;
    } catch (err) {
      if (isMissingColumnError(err)) {
        await db["customer"]["update"]({
          where: { id, orgId },
          data: {},
        });
        await revalidateWithLocale("/dashboard/customers");
        await revalidateWithLocale(`/dashboard/customers/${id}`);
        return existing;
      }
      throw err;
    }
  });
}

export async function getCustomerActivityLog(customerId: string) {
  return withActionError("getCustomerActivityLog", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const customer = await db["customer"]["findFirst"]({
      where: { id: customerId, orgId },
      select: { id: true },
    });
    if (!customer) actionError("Customer not found");

    let invoices: any[] = [];
    let estimates: any[] = [];
    let payments: any[] = [];
    // Use allSettled so a single failing query does not lose the other two
    // buckets. Drift errors (missing column / missing table) are absorbed and
    // surfaced as a warning, not a 500: the page still renders the data we
    // did get back.
    const results = await Promise["allSettled"]([
      db["invoice"]["findMany"]({
        where: { customerId, orgId },
        select: { id: true, number: true, status: true, total: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 34,
      }),
      db["estimate"]["findMany"]({
        where: { customerId, orgId },
        select: { id: true, number: true, status: true, total: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 34,
      }),
      db["payment"]["findMany"]({
        where: { invoice: { customerId, orgId } },
        select: { id: true, amount: true, method: true, status: true, createdAt: true, invoice: { select: { number: true } } },
        orderBy: { createdAt: "desc" },
        take: 34,
      }),
    ]);

    const labels = ["invoices", "estimates", "payments"] as const;
    results["forEach"]((r, i) => {
      if (r["status"] === "fulfilled") {
        if (i === 0) invoices = r["value"] as any[];
        else if (i === 1) estimates = r["value"] as any[];
        else payments = r["value"] as any[];
        return;
      }
      const reason = r["reason"];
      if (isMissingColumnError(reason) || isMissingTableError(reason)) {
        logWarn("clients.activity", `${labels[i]} unavailable (schema drift)`, {
          customerId,
          reason: reason instanceof Error ? reason["message"] : String(reason),
        });
        return;
      }
      // Anything else re-throws via withActionError, surfacing a clean 500.
      throw reason;
    });

    type Activity = {
      id: string;
      type: "INVOICE" | "ESTIMATE" | "PAYMENT";
      description: string;
      amount?: number;
      status?: string;
      date: Date;
    };

    // Plan C6: the previous K-way merge was O(n) but biased ties to the
    // invoice bucket (`>=` with strict `if/else if`). For two events with
    // identical timestamps the deterministic tie-break now is explicit
    // (INVOICE < ESTIMATE < PAYMENT by type priority, then by id), and the
    // ordering is a single `sort` over the flat array — less code, easier
    // to reason about, and a stable secondary key.
    const TYPE_PRIORITY: Record<Activity["type"], number> = {
      INVOICE: 0,
      ESTIMATE: 1,
      PAYMENT: 2,
    };
    const merged: Activity[] = [];
    for (const inv of invoices) {
      merged["push"]({
        id: inv["id"],
        type: "INVOICE",
        description: `Invoice ${inv["number"]}`,
        amount: inv["total"],
        status: inv["status"],
        date: inv["createdAt"],
      });
    }
    for (const est of estimates) {
      merged["push"]({
        id: est["id"],
        type: "ESTIMATE",
        description: `Estimate ${est["number"]}`,
        amount: est["total"],
        status: est["status"],
        date: est["createdAt"],
      });
    }
    for (const pay of payments) {
      merged["push"]({
        id: pay["id"],
        type: "PAYMENT",
        description: `Payment for ${pay["invoice"]?.["number"] || "invoice"}`,
        amount: pay["amount"],
        status: pay["status"],
        date: pay["createdAt"],
      });
    }
    merged["sort"]((a, b) => {
      const dt = new Date(b["date"])["getTime"]() - new Date(a["date"])["getTime"]();
      if (dt !== 0) return dt;
      const pt = TYPE_PRIORITY[a["type"]] - TYPE_PRIORITY[b["type"]];
      if (pt !== 0) return pt;
      return a["id"]["localeCompare"](b["id"]);
    });
    return merged["slice"](0, 100);
  });
}
