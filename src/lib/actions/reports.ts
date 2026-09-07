"use server";

import { format as formatDateFn } from "date-fns";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { isMissingColumnError, isInvalidEnumValueError } from "@/lib/db-drift";
import { withActionError, actionError } from "@/lib/action-errors";

export async function getRevenueReport(year?: number) {
  return withActionError("getRevenueReport", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const targetYear = year ?? new Date()["getFullYear"]();

    let months;
    try {
      months = await db["invoice"]["aggregate"]({
        where: {
          orgId,
          issueDate: {
            gte: new Date(`${targetYear}-01-01`),
            lte: new Date(`${targetYear}-12-31T23:59:59.999Z`),
          },
        },
        _sum: {
          total: true,
          taxAmount: true,
          discount: true,
          amountPaid: true,
          lateFeeAmount: true,
        },
        _count: {
          _all: true,
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        months = await db["invoice"]["aggregate"]({
          where: {
            orgId,
            issueDate: {
              gte: new Date(`${targetYear}-01-01`),
              lte: new Date(`${targetYear}-12-31T23:59:59.999Z`),
            },
          },
          _sum: {
            total: true,
            taxAmount: true,
            discount: true,
            amountPaid: true,
          },
          _count: {
            _all: true,
          },
        });
      } else {
        throw err;
      }
    }

    let monthlyData;
    try {
      monthlyData = await db["invoice"]["findMany"]({
        where: {
          orgId,
          issueDate: {
            gte: new Date(`${targetYear}-01-01`),
            lte: new Date(`${targetYear}-12-31T23:59:59.999Z`),
          },
        },
        select: {
          issueDate: true,
          total: true,
          taxAmount: true,
          discount: true,
          amountPaid: true,
          lateFeeAmount: true,
          status: true,
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        monthlyData = await db["invoice"]["findMany"]({
          where: {
            orgId,
            issueDate: {
              gte: new Date(`${targetYear}-01-01`),
              lte: new Date(`${targetYear}-12-31T23:59:59.999Z`),
            },
          },
          select: {
            issueDate: true,
            total: true,
            taxAmount: true,
            discount: true,
            amountPaid: true,
            status: true,
          },
        });
      } else {
        throw err;
      }
    }

    const monthlyMap: Record<string, any> = {};
    for (let m = 0; m < 12; m++) {
      const monthKey = `${targetYear}-${String(m + 1)["padStart"](2, "0")}`;
      monthlyMap[monthKey] = {
        total: 0,
        taxAmount: 0,
        discount: 0,
        amountPaid: 0,
        lateFeeAmount: 0,
        count: 0,
      };
    }

    for (const inv of monthlyData) {
      const monthKey = formatDateFn(inv["issueDate"], "yyyy-MM");

      if (monthlyMap[monthKey]) {
        monthlyMap[monthKey]["total"] += inv["total"];
        monthlyMap[monthKey]["taxAmount"] += inv["taxAmount"];
        monthlyMap[monthKey]["discount"] += inv["discount"];
        monthlyMap[monthKey]["amountPaid"] += inv["amountPaid"];
        monthlyMap[monthKey]["lateFeeAmount"] += (inv as any)["lateFeeAmount"] ?? 0;
        monthlyMap[monthKey]["count"] += 1;
      }
    }

    const annual = months;

    return {
      year: targetYear,
      monthly: Object["entries"](monthlyMap)["map"](([month, data]) => ({
        month,
        total: data["total"],
        taxAmount: data["taxAmount"],
        discount: data["discount"],
        amountPaid: data["amountPaid"],
        lateFeeAmount: data["lateFeeAmount"],
        count: data["count"],
      })),
      annual: {
        total: annual["_sum"]["total"] ?? 0,
        taxAmount: annual["_sum"]["taxAmount"] ?? 0,
        discount: annual["_sum"]["discount"] ?? 0,
        amountPaid: annual["_sum"]["amountPaid"] ?? 0,
        lateFeeAmount: (annual["_sum"] as any)["lateFeeAmount"] ?? 0,
        count: annual["_count"]["_all"] ?? 0,
      },
    };
  });
}

export async function getOutstandingReport() {
  return withActionError("getOutstandingReport", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    let invoices;
    try {
      invoices = await db["invoice"]["findMany"]({
        where: {
          orgId,
          status: { in: ["SENT", "VIEWED", "UNPAID", "OVERDUE"] },
        },
        include: {
          customer: { select: { name: true, email: true } },
        },
        orderBy: { dueDate: "asc" },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        invoices = await db["invoice"]["findMany"]({
          where: {
            orgId,
            status: { in: ["SENT", "VIEWED", "UNPAID", "OVERDUE"] },
          },
          select: {
            id: true,
            number: true,
            customerId: true,
            dueDate: true,
            total: true,
            amountPaid: true,
            status: true,
            currency: true,
            customer: { select: { name: true, email: true } },
          },
          orderBy: { dueDate: "asc" },
        });
      } else if (isInvalidEnumValueError(err)) {
        invoices = await db["invoice"]["findMany"]({
          where: {
            orgId,
            status: { in: ["SENT", "VIEWED", "OVERDUE"] },
          },
          select: {
            id: true,
            number: true,
            customerId: true,
            dueDate: true,
            total: true,
            amountPaid: true,
            status: true,
            currency: true,
            customer: { select: { name: true, email: true } },
          },
          orderBy: { dueDate: "asc" },
        });
      } else {
        throw err;
      }
    }

    const outstanding = invoices["map"]((inv) => {
      const balance = inv["total"] - inv["amountPaid"];
      return {
        id: inv["id"],
        number: inv["number"],
        customerId: inv["customerId"],
        customerName: inv["customer"]?.["name"] ?? "Unknown",
        customerEmail: inv["customer"]?.["email"],
        dueDate: inv["dueDate"],
        total: inv["total"],
        amountPaid: inv["amountPaid"],
        balance,
        status: inv["status"],
        currency: inv["currency"],
        daysOverdue: inv["dueDate"]
          ? Math["max"](0, Math["floor"]((Date["now"]() - new Date(inv["dueDate"])["getTime"]()) / (1000 * 60 * 60 * 24)))
          : 0,
      };
    });

    const totalOutstanding = outstanding["reduce"]((sum, inv) => sum + inv["balance"], 0);
    const overdue = outstanding["filter"]((inv) => inv["daysOverdue"] > 0);
    const totalOverdue = overdue["reduce"]((sum, inv) => sum + inv["balance"], 0);

    return {
      totalOutstanding,
      totalOverdue,
      overdueCount: overdue["length"],
      unpaidCount: outstanding["length"],
      invoices: outstanding,
    };
  });
}

export async function getTaxesCollectedReport(year?: number) {
  return withActionError("getTaxesCollectedReport", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const targetYear = year ?? new Date()["getFullYear"]();

    let invoices;
    try {
      invoices = await db["invoice"]["findMany"]({
        where: {
          orgId,
          issueDate: {
            gte: new Date(`${targetYear}-01-01`),
            lte: new Date(`${targetYear}-12-31T23:59:59.999Z`),
          },
        },
        select: {
          issueDate: true,
          taxRate: true,
          taxAmount: true,
          currency: true,
          status: true,
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        invoices = await db["invoice"]["findMany"]({
          where: {
            orgId,
            issueDate: {
              gte: new Date(`${targetYear}-01-01`),
              lte: new Date(`${targetYear}-12-31T23:59:59.999Z`),
            },
          },
          select: {
            issueDate: true,
            taxRate: true,
            taxAmount: true,
            status: true,
          },
        });
      } else {
        throw err;
      }
    }

    const monthlyMap: Record<string, any> = {};
    for (let m = 0; m < 12; m++) {
      const monthKey = `${targetYear}-${String(m + 1)["padStart"](2, "0")}`;
      monthlyMap[monthKey] = {
        taxAmount: 0,
        taxRate: 0,
        count: 0,
      };
    }

    let totalTax = 0;
    for (const inv of invoices) {
      const monthKey = formatDateFn(inv["issueDate"], "yyyy-MM");
      if (monthlyMap[monthKey]) {
        monthlyMap[monthKey]["taxAmount"] += inv["taxAmount"];
        monthlyMap[monthKey]["count"] += 1;
      }
      totalTax += inv["taxAmount"];
    }

    const avgTaxRate = invoices["length"] > 0
      ? invoices["reduce"]((sum, inv) => sum + inv["taxRate"], 0) / invoices["length"]
      : 0;

    return {
      year: targetYear,
      totalTaxCollected: totalTax,
      averageTaxRate: avgTaxRate,
      invoiceCount: invoices["length"],
      monthly: Object["entries"](monthlyMap)["map"](([month, data]) => ({
        month,
        taxAmount: data["taxAmount"],
        count: data["count"],
      })),
    };
  });
}

export async function getCustomerAnalytics() {
  return withActionError("getCustomerAnalytics", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    let customers;
    try {
      customers = await db["customer"]["findMany"]({
        where: { orgId },
        include: {
          invoices: {
            select: {
              total: true,
              amountPaid: true,
              taxAmount: true,
              createdAt: true,
              number: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        customers = await db["customer"]["findMany"]({
          where: { orgId },
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            invoices: {
              select: {
                total: true,
                amountPaid: true,
                taxAmount: true,
                createdAt: true,
                number: true,
              },
            },
          },
          orderBy: { name: "asc" },
        });
      } else {
        throw err;
      }
    }

    const analytics = customers["map"]((c) => {
      const invoiceCount = c["invoices"]["length"];
      const totalInvoiced = c["invoices"]["reduce"]((sum, inv) => sum + inv["total"], 0);
      const totalPaid = c["invoices"]["reduce"]((sum, inv) => sum + inv["amountPaid"], 0);
      const totalTax = c["invoices"]["reduce"]((sum, inv) => sum + inv["taxAmount"], 0);
      const outstanding = totalInvoiced - totalPaid;
      const averageInvoice = invoiceCount > 0 ? totalInvoiced / invoiceCount : 0;
      const lastInvoiceDate = c["invoices"]["length"] > 0
        ? new Date(Math["max"](...c["invoices"]["map"]((inv) => new Date(inv["createdAt"])["getTime"]())))
        : null;

      return {
        id: c["id"],
        name: c["name"],
        company: c["company"],
        email: c["email"],
        invoiceCount,
        totalInvoiced,
        totalPaid,
        totalTaxCollected: totalTax,
        outstanding,
        averageInvoice,
        lastInvoiceDate,
      };
    });

    analytics["sort"]((a, b) => b["totalInvoiced"] - a["totalInvoiced"]);

    const totalRevenue = analytics["reduce"]((sum, c) => sum + c["totalPaid"], 0);
    const totalCustomerCount = analytics["length"];
    const activeCustomers = analytics["filter"](
      (c) => c["totalInvoiced"] > 0 && c["invoiceCount"] > 0
    )["length"];

    return {
      totalRevenue,
      customerCount: totalCustomerCount,
      activeCustomerCount: activeCustomers,
      customers: analytics,
    };
  });
}

export async function exportInvoices(format: "csv" | "xlsx") {
  return withActionError("exportInvoices", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    let invoices;
    try {
      invoices = await db["invoice"]["findMany"]({
        where: { orgId },
        include: {
          customer: { select: { name: true, email: true } },
          items: true,
          payments: { select: { amount: true, method: true, createdAt: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        invoices = await db["invoice"]["findMany"]({
          where: { orgId },
          select: {
            id: true,
            number: true,
            customerId: true,
            type: true,
            status: true,
            issueDate: true,
            dueDate: true,
            currency: true,
            subtotal: true,
            taxRate: true,
            taxAmount: true,
            discount: true,
            total: true,
            amountPaid: true,
            notes: true,
            createdAt: true,
            customer: { select: { name: true, email: true } },
            items: { select: { description: true, quantity: true, unitPrice: true, amount: true } },
          },
          orderBy: { createdAt: "asc" },
        });
      } else {
        throw err;
      }
    }

    const data = invoices["map"]((inv) => ({
      "Invoice #": inv["number"],
      "Status": inv["status"],
      "Customer": inv["customer"]?.["name"] ?? "",
      "Customer Email": inv["customer"]?.["email"] ?? "",
        "Issue Date": inv["issueDate"]["toISOString"]()["split"]("T")[0],
        "Due Date": inv["dueDate"] ? inv["dueDate"]["toISOString"]()["split"]("T")[0] : "",
        "Type": inv["type"],
        "Subtotal": inv["subtotal"],
        "Tax Amount": inv["taxAmount"],
        "Discount": inv["discount"],
        "Late Fee": (inv as any)["lateFeeAmount"] ?? 0,
        "Total": inv["total"],
        "Amount Paid": inv["amountPaid"],
        "Balance": inv["total"] - inv["amountPaid"],
        "Currency": inv["currency"],
        "Notes": inv["notes"] ?? "",
    }));

    if (format === "csv") {
      const headers = Object["keys"](data[0] || {});
      const rows = data["map"]((row) =>
        headers["map"]((h) => {
          const val = row[h as keyof typeof row];
          const str = String(val ?? "");
          return str["includes"](",") ? `"${str}"` : str;
        })["join"](",")
      );
      const csv = [headers["join"](","), ...rows]["join"]("\n");
      return { content: csv, filename: `invoices-${formatDateFn(new Date(), "yyyy-MM-dd")}.csv` };
    }

    const xlsx = await import("xlsx");
    const ws = xlsx["utils"]["json_to_sheet"](data);
    const wb = xlsx["utils"]["book_new"]();
    xlsx["utils"]["book_append_sheet"](wb, ws, "Invoices");
    const buf = xlsx["write"](wb, { type: "array", bookType: "xlsx" });
    const base64 = Buffer["from"](buf)["toString"]("base64");
    return { content: base64, filename: `invoices-${formatDateFn(new Date(), "yyyy-MM-dd")}.xlsx` };
  });
}

export interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  count: number;
  total: number;
  invoices: Array<{
    id: string;
    number: string;
    customerName: string;
    dueDate: Date | null;
    balance: number;
    daysOverdue: number;
    status: string;
    currency: string;
  }>;
}

export interface AgingReport {
  buckets: AgingBucket[];
  totalOutstanding: number;
  totalOverdue: number;
  currency: string;
  generatedAt: Date;
}

const AGING_BUCKETS = [
  { label: "1-30 days", minDays: 1, maxDays: 30 },
  { label: "31-60 days", minDays: 31, maxDays: 60 },
  { label: "61-90 days", minDays: 61, maxDays: 90 },
  { label: "90+ days", minDays: 91, maxDays: null },
];

export async function getAgingReport() {
  return withActionError("getAgingReport", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    let invoices;
    try {
      invoices = await db["invoice"]["findMany"]({
        where: {
          orgId,
          status: { in: ["SENT", "VIEWED", "UNPAID", "OVERDUE", "PARTIALLY_PAID"] },
          dueDate: { lte: new Date() },
        },
        include: { customer: { select: { name: true, email: true } } },
        orderBy: { dueDate: "asc" },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        invoices = await db["invoice"]["findMany"]({
          where: {
            orgId,
            status: { in: ["SENT", "VIEWED", "UNPAID", "OVERDUE"] },
            dueDate: { lte: new Date() },
          },
          select: {
            id: true,
            number: true,
            customerId: true,
            dueDate: true,
            total: true,
            amountPaid: true,
            status: true,
            currency: true,
            customer: { select: { name: true, email: true } },
          },
          orderBy: { dueDate: "asc" },
        });
      } else if (isInvalidEnumValueError(err)) {
        invoices = await db["invoice"]["findMany"]({
          where: {
            orgId,
            status: { in: ["SENT", "VIEWED", "OVERDUE"] },
            dueDate: { lte: new Date() },
          },
          select: {
            id: true,
            number: true,
            customerId: true,
            dueDate: true,
            total: true,
            amountPaid: true,
            status: true,
            currency: true,
            customer: { select: { name: true, email: true } },
          },
          orderBy: { dueDate: "asc" },
        });
      } else {
        throw err;
      }
    }

    const now = new Date();
    const buckets: AgingBucket[] = AGING_BUCKETS["map"](b => ({
      label: b["label"],
      minDays: b["minDays"],
      maxDays: b["maxDays"],
      count: 0,
      total: 0,
      invoices: [],
    }));

    const notDueBucket: AgingBucket = {
      label: "Not yet due",
      minDays: 0,
      maxDays: 0,
      count: 0,
      total: 0,
      invoices: [],
    };

    let totalOutstanding = 0;
    let totalOverdue = 0;
    const currency = invoices["length"] > 0 ? (invoices[0]["currency"] ?? "USD") : "USD";

    for (const inv of invoices) {
      const balance = inv["total"] - inv["amountPaid"];
      if (balance <= 0) continue;

      totalOutstanding += balance;

      let daysOverdue = 0;
      if (inv["dueDate"]) {
        daysOverdue = Math["max"](0, Math["floor"](
          (now["getTime"]() - new Date(inv["dueDate"])["getTime"]()) / (1000 * 60 * 60 * 24)
        ));
      }

      const invoiceEntry = {
        id: inv["id"],
        number: inv["number"],
        customerName: inv["customer"]?.["name"] ?? "Unknown",
        dueDate: inv["dueDate"],
        balance,
        daysOverdue,
        status: inv["status"],
        currency: inv["currency"],
      };

      if (daysOverdue === 0) {
        notDueBucket["count"] += 1;
        notDueBucket["total"] += balance;
        notDueBucket["invoices"]["push"](invoiceEntry);
      } else {
        totalOverdue += balance;
        for (const bucket of buckets) {
          if (daysOverdue >= bucket["minDays"] && (bucket["maxDays"] === null || daysOverdue <= bucket["maxDays"])) {
            bucket["count"] += 1;
            bucket["total"] += balance;
            bucket["invoices"]["push"](invoiceEntry);
            break;
          }
        }
      }
    }

    return {
      buckets: [notDueBucket, ...buckets],
      totalOutstanding,
      totalOverdue,
      currency,
      generatedAt: now,
    };
  });
}

export interface ProjectFinancialSummary {
  id: string;
  name: string;
  number?: string | null;
  status: string;
  contractValue: number;
  totalInvoiced: number;
  amountPaid: number;
  estimatedCost: number;
  totalExpenses: number;
  totalTimeBillable: number;
  changeOrdersTotal: number;
  retainageHeld: number;
  balance: number;
  currency: string;
}

export interface ProjectProfitabilityReport {
  projects: ProjectFinancialSummary[];
  totals: {
    totalContractValue: number;
    totalInvoiced: number;
    totalCollected: number;
    totalCosts: number;
    totalProfit: number;
    grossMargin: number;
  };
  currency: string;
  generatedAt: Date;
}

export async function getProjectFinancialReport() {
  return withActionError("getProjectFinancialReport", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const now = new Date();
    let projects;
    try {
      projects = await db["project"]["findMany"]({
        where: { orgId },
        select: {
          id: true,
          name: true,
          number: true,
          status: true,
          contractValue: true,
          estimatedCost: true,
          retainageRate: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
      projects = await db["project"]["findMany"]({
        where: { orgId },
        select: {
          id: true,
          name: true,
          number: true,
          contractValue: true,
          estimatedCost: true,
          status: true,
        },
        orderBy: { createdAt: "desc" },
      });
      } else {
        throw err;
      }
    }

    const currency = "USD";

    const summaries: ProjectFinancialSummary[] = await Promise["all"](
      projects["map"](async (proj: any) => {
        let invoices: any[] = [];
        let changeOrders: any[] = [];
        let expenses: any[] = [];
        let timeEntries: any[] = [];
        let milestones: any[] = [];

        try {
          [invoices, changeOrders, expenses, timeEntries, milestones] = await Promise["all"]([
            db["invoice"]["findMany"]({
              where: { orgId, projectId: proj["id"] },
              select: { total: true, amountPaid: true, retainageAmount: true },
            }),
            db["changeOrder"]["findMany"]({
              where: { orgId, projectId: proj["id"], status: "APPROVED" },
              select: { changeAmount: true },
            }),
            db["expense"]["findMany"]({
              where: { orgId, projectId: proj["id"] },
              select: { amount: true },
            }),
            db["timeEntry"]["findMany"]({
              where: { orgId, projectId: proj["id"], billable: true },
              select: { amount: true },
            }),
            db["projectMilestone"]["findMany"]({
              where: { orgId, projectId: proj["id"], status: "COMPLETED" },
              select: { amount: true },
            }),
          ]);
        } catch (err) {
          if (isMissingColumnError(err)) {
            try {
              [invoices, changeOrders, expenses] = await Promise["all"]([
                db["invoice"]["findMany"]({
                  where: { orgId, projectId: proj["id"] },
                  select: { total: true, amountPaid: true },
                }),
                db["changeOrder"]["findMany"]({
                  where: { orgId, projectId: proj["id"], status: "APPROVED" },
                  select: { changeAmount: true },
                }),
                db["expense"]["findMany"]({
                  where: { orgId, projectId: proj["id"] },
                  select: { amount: true },
                }),
              ]);
            } catch {
              invoices = [];
              changeOrders = [];
              expenses = [];
              timeEntries = [];
              milestones = [];
            }
          } else {
            throw err;
          }
        }

        const totalInvoiced = invoices["reduce"]((s, inv) => s + (inv["total"] ?? 0), 0);
        const amountPaid = invoices["reduce"]((s, inv) => s + (inv["amountPaid"] ?? 0), 0);
        const totalExpenses = expenses["reduce"]((s, e) => s + (e["amount"] ?? 0), 0);
        const totalTimeBillable = (timeEntries ?? [])["reduce"]((s, t) => s + (t["amount"] ?? 0), 0);
        const changeOrdersTotal = changeOrders["reduce"]((s, co) => s + (co["changeAmount"] ?? 0), 0);
        const retainageHeld = invoices["reduce"]((s, inv) => s + (inv["retainageAmount"] ?? 0), 0);
        const balance = totalInvoiced - amountPaid;

        return {
          id: proj["id"],
          name: proj["name"],
          number: proj["number"] ?? null,
          status: proj["status"] ?? "ACTIVE",
          contractValue: Number(proj["contractValue"] ?? 0),
          totalInvoiced,
          amountPaid,
          estimatedCost: Number(proj["estimatedCost"] ?? 0),
          totalExpenses,
          totalTimeBillable,
          changeOrdersTotal,
          retainageHeld,
          balance,
          currency,
        };
      })
    );

    const totalContractValue = summaries["reduce"]((s, p) => s + p["contractValue"], 0);
    const totalInvoiced = summaries["reduce"]((s, p) => s + p["totalInvoiced"], 0);
    const totalCollected = summaries["reduce"]((s, p) => s + p["amountPaid"], 0);
    const totalCosts = summaries["reduce"]((s, p) => s + p["totalExpenses"] + p["totalTimeBillable"], 0);
    const totalProfit = totalCollected - totalCosts;
    const grossMargin = totalCollected > 0 ? (totalProfit / totalCollected) * 100 : 0;

    return {
      projects: summaries,
      totals: {
        totalContractValue,
        totalInvoiced,
        totalCollected,
        totalCosts,
        totalProfit,
        grossMargin,
      },
      currency,
      generatedAt: now,
    };
  });
}

export interface CashFlowForecast {
  period: string;
  expectedInflows: number;
  expectedOutflows: number;
  netCashFlow: number;
  cumulative: number;
  invoices: Array<{ number: string; customerName: string; amount: number; dueDate: Date }>;
}

export interface CashFlowForecastReport {
  periods: CashFlowForecast[];
  totalExpectedInflows: number;
  totalExpectedOutflows: number;
  netCashFlow: number;
  currency: string;
  generatedAt: Date;
}

export async function getCashFlowForecast(monthsAhead = 3) {
  return withActionError("getCashFlowForecast", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const now = new Date();
    const endDate = new Date(now);
    endDate["setMonth"](endDate["getMonth"]() + monthsAhead);

    let invoices: any[] = [];
    let expenses: any[] = [];

    try {
      [invoices, expenses] = await Promise["all"]([
        db["invoice"]["findMany"]({
          where: {
            orgId,
            status: { in: ["SENT", "VIEWED", "UNPAID", "OVERDUE", "PARTIALLY_PAID"] },
            dueDate: { gte: now, lte: endDate },
          },
          include: { customer: { select: { name: true } } },
        }),
        db["expense"]["findMany"]({
          where: { orgId, date: { gte: now, lte: endDate } },
        }),
      ]);
    } catch (err) {
      if (isMissingColumnError(err)) {
        invoices = await db["invoice"]["findMany"]({
          where: {
            orgId,
            status: { in: ["SENT", "VIEWED", "UNPAID", "OVERDUE"] },
            dueDate: { gte: now, lte: endDate },
          },
          select: {
            number: true,
            total: true,
            amountPaid: true,
            dueDate: true,
            currency: true,
            customer: { select: { name: true } },
          },
        });
        expenses = [];
      } else {
        throw err;
      }
    }

    const currency = invoices["length"] > 0 ? (invoices[0]["currency"] ?? "USD") : "USD";

    const periods: CashFlowForecast[] = [];
    let cumulative = summaries_cumulative(invoices, expenses);

    for (let m = 0; m < monthsAhead; m++) {
      const periodStart = new Date(now);
      periodStart["setMonth"](periodStart["getMonth"]() + m);
      const periodEnd = new Date(periodStart);
      periodEnd["setMonth"](periodEnd["getMonth"]() + 1);
      periodEnd["setDate"](periodEnd["getDate"]() - 1);

      const periodInvoices = invoices["filter"]((inv: any) => {
        const due = new Date(inv["dueDate"]);
        return due >= periodStart && due <= periodEnd;
      });

      const periodExpenses = expenses["filter"]((exp: any) => {
        const date = new Date(exp["date"]);
        return date >= periodStart && date <= periodEnd;
      });

      const expectedInflows = periodInvoices["reduce"]((s: number, inv: any) => s + (inv["total"] - inv["amountPaid"]), 0);
      const expectedOutflows = periodExpenses["reduce"]((s: number, exp: any) => s + (exp["amount"] ?? 0), 0);

      cumulative += expectedInflows - expectedOutflows;

      periods["push"]({
        period: formatDateFn(periodStart, "MMM yyyy"),
        expectedInflows,
        expectedOutflows,
        netCashFlow: expectedInflows - expectedOutflows,
        cumulative,
        invoices: periodInvoices["map"]((inv: any) => ({
          number: inv["number"],
          customerName: inv["customer"]?.["name"] ?? "Unknown",
          amount: inv["total"] - inv["amountPaid"],
          dueDate: inv["dueDate"],
        })),
      });
    }

    const totalExpectedInflows = periods["reduce"]((s, p) => s + p["expectedInflows"], 0);
    const totalExpectedOutflows = periods["reduce"]((s, p) => s + p["expectedOutflows"], 0);

    return {
      periods,
      totalExpectedInflows,
      totalExpectedOutflows,
      netCashFlow: totalExpectedInflows - totalExpectedOutflows,
      currency,
      generatedAt: now,
    };
  });
}

function summaries_cumulative(invoices: any[], expenses: any[]): number {
  const invTotal = invoices["reduce"]((s, inv) => s + (inv["total"] - inv["amountPaid"]), 0);
  const expTotal = expenses["reduce"]((s, exp) => s + (exp["amount"] ?? 0), 0);
  return invTotal - expTotal;
}
