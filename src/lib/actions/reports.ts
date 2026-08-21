"use server";

import { format as formatDateFn } from "date-fns";
import { db } from "@/lib/db";
import { requireUser, isMissingColumnError, isInvalidEnumValueError } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";

export async function getRevenueReport(year?: number) {
  return withActionError("getRevenueReport", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    const targetYear = year ?? new Date().getFullYear();

    let months;
    try {
      months = await db.invoice.aggregate({
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
        months = await db.invoice.aggregate({
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
      monthlyData = await db.invoice.findMany({
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
        monthlyData = await db.invoice.findMany({
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
      const monthKey = `${targetYear}-${String(m + 1).padStart(2, "0")}`;
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
      const monthKey = formatDateFn(inv.issueDate, "yyyy-MM");

      if (monthlyMap[monthKey]) {
        monthlyMap[monthKey].total += inv.total;
        monthlyMap[monthKey].taxAmount += inv.taxAmount;
        monthlyMap[monthKey].discount += inv.discount;
        monthlyMap[monthKey].amountPaid += inv.amountPaid;
        monthlyMap[monthKey].lateFeeAmount += (inv as any).lateFeeAmount ?? 0;
        monthlyMap[monthKey].count += 1;
      }
    }

    const annual = months;

    return {
      year: targetYear,
      monthly: Object.entries(monthlyMap).map(([month, data]) => ({
        month,
        total: data.total,
        taxAmount: data.taxAmount,
        discount: data.discount,
        amountPaid: data.amountPaid,
        lateFeeAmount: data.lateFeeAmount,
        count: data.count,
      })),
      annual: {
        total: annual._sum.total ?? 0,
        taxAmount: annual._sum.taxAmount ?? 0,
        discount: annual._sum.discount ?? 0,
        amountPaid: annual._sum.amountPaid ?? 0,
        lateFeeAmount: (annual._sum as any).lateFeeAmount ?? 0,
        count: annual._count._all ?? 0,
      },
    };
  });
}

export async function getOutstandingReport() {
  return withActionError("getOutstandingReport", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    let invoices;
    try {
      invoices = await db.invoice.findMany({
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
        invoices = await db.invoice.findMany({
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
        invoices = await db.invoice.findMany({
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

    const outstanding = invoices.map((inv) => {
      const balance = inv.total - inv.amountPaid;
      return {
        id: inv.id,
        number: inv.number,
        customerId: inv.customerId,
        customerName: inv.customer?.name ?? "Unknown",
        customerEmail: inv.customer?.email,
        dueDate: inv.dueDate,
        total: inv.total,
        amountPaid: inv.amountPaid,
        balance,
        status: inv.status,
        currency: inv.currency,
        daysOverdue: inv.dueDate
          ? Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
          : 0,
      };
    });

    const totalOutstanding = outstanding.reduce((sum, inv) => sum + inv.balance, 0);
    const overdue = outstanding.filter((inv) => inv.daysOverdue > 0);
    const totalOverdue = overdue.reduce((sum, inv) => sum + inv.balance, 0);

    return {
      totalOutstanding,
      totalOverdue,
      overdueCount: overdue.length,
      unpaidCount: outstanding.length,
      invoices: outstanding,
    };
  });
}

export async function getTaxesCollectedReport(year?: number) {
  return withActionError("getTaxesCollectedReport", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    const targetYear = year ?? new Date().getFullYear();

    const invoices = await db.invoice.findMany({
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

    const monthlyMap: Record<string, any> = {};
    for (let m = 0; m < 12; m++) {
      const monthKey = `${targetYear}-${String(m + 1).padStart(2, "0")}`;
      monthlyMap[monthKey] = {
        taxAmount: 0,
        taxRate: 0,
        count: 0,
      };
    }

    let totalTax = 0;
    for (const inv of invoices) {
      const monthKey = formatDateFn(inv.issueDate, "yyyy-MM");
      if (monthlyMap[monthKey]) {
        monthlyMap[monthKey].taxAmount += inv.taxAmount;
        monthlyMap[monthKey].count += 1;
      }
      totalTax += inv.taxAmount;
    }

    const avgTaxRate = invoices.length > 0
      ? invoices.reduce((sum, inv) => sum + inv.taxRate, 0) / invoices.length
      : 0;

    return {
      year: targetYear,
      totalTaxCollected: totalTax,
      averageTaxRate: avgTaxRate,
      invoiceCount: invoices.length,
      monthly: Object.entries(monthlyMap).map(([month, data]) => ({
        month,
        taxAmount: data.taxAmount,
        count: data.count,
      })),
    };
  });
}

export async function getCustomerAnalytics() {
  return withActionError("getCustomerAnalytics", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    const customers = await db.customer.findMany({
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

    const analytics = customers.map((c) => {
      const invoiceCount = c.invoices.length;
      const totalInvoiced = c.invoices.reduce((sum, inv) => sum + inv.total, 0);
      const totalPaid = c.invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
      const totalTax = c.invoices.reduce((sum, inv) => sum + inv.taxAmount, 0);
      const outstanding = totalInvoiced - totalPaid;
      const averageInvoice = invoiceCount > 0 ? totalInvoiced / invoiceCount : 0;
      const lastInvoiceDate = c.invoices.length > 0
        ? new Date(Math.max(...c.invoices.map((inv) => new Date(inv.createdAt).getTime())))
        : null;

      return {
        id: c.id,
        name: c.name,
        company: c.company,
        email: c.email,
        invoiceCount,
        totalInvoiced,
        totalPaid,
        totalTaxCollected: totalTax,
        outstanding,
        averageInvoice,
        lastInvoiceDate,
      };
    });

    analytics.sort((a, b) => b.totalInvoiced - a.totalInvoiced);

    const totalRevenue = analytics.reduce((sum, c) => sum + c.totalPaid, 0);
    const totalCustomerCount = analytics.length;
    const activeCustomers = analytics.filter(
      (c) => c.totalInvoiced > 0 && c.invoiceCount > 0
    ).length;

    return {
      totalRevenue,
      customerCount: totalCustomerCount,
      activeCustomerCount: activeCustomers,
      customers: analytics,
    };
  });
}

export interface FinancialDashboardData {
  kpis: {
    totalRevenue: number;
    outstandingBalance: number;
    overdueAmount: number;
    paidThisMonth: number;
  };
  revenueOverTime: Array<{ date: string; total: number; amountPaid: number }>;
  paidVsOutstanding: { paid: number; outstanding: number };
  overdueBreakdown: Array<{ customerName: string; amount: number; daysOverdue: number; invoiceNumber: string }>;
  revenueByCustomer: Array<{ name: string; amount: number; color: string }>;
  invoices: Array<{
    id: string;
    number: string;
    customerName: string;
    customerCompany?: string | null;
    amount: number;
    dueDate: Date;
    status: string;
    currency: string;
    daysOverdue: number;
  }>;
}

export async function getFinancialDashboardData(): Promise<FinancialDashboardData> {
  return withActionError("getFinancialDashboardData", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 30);

    // Fetch all invoices with customer data
    let invoices;
    try {
      invoices = await db.invoice.findMany({
        where: { orgId },
        include: { customer: true },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        invoices = await db.invoice.findMany({
          where: { orgId },
          select: {
            id: true,
            number: true,
            customerId: true,
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
            customer: true,
          },
        }) as any;
      } else {
        throw err;
      }
    }

    // KPIs
    const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
    const outstandingBalance = invoices
      .filter((inv: any) => (inv.total || 0) - (inv.amountPaid || 0) > 0)
      .reduce((sum: number, inv: any) => sum + (inv.total || 0) - (inv.amountPaid || 0), 0);

    const overdueInvoices = invoices.filter((inv: any) => {
      if (!inv.dueDate) return false;
      const due = new Date(inv.dueDate);
      return due < now && (inv.total - inv.amountPaid) > 0;
    });
    const overdueAmount = overdueInvoices.reduce(
      (sum: number, inv: any) => sum + (inv.total || 0) - (inv.amountPaid || 0),
      0
    );

    const currentMonthInvoices = invoices.filter((inv: any) => {
      const issue = new Date(inv.issueDate);
      return issue >= startOfMonth;
    });
    const paidThisMonth = currentMonthInvoices.reduce(
      (sum: number, inv: any) => sum + (inv.amountPaid || 0),
      0
    );

    // Revenue over time (last 30 days, grouped by day)
    const recentInvoices = invoices.filter((inv: any) => {
      const issue = new Date(inv.issueDate);
      return issue >= startOfWeek;
    });

    const dailyMap: Record<string, { total: number; amountPaid: number }> = {};
    for (const inv of recentInvoices) {
      const day = new Date(inv.issueDate).toISOString().split("T")[0];
      if (!dailyMap[day]) dailyMap[day] = { total: 0, amountPaid: 0 };
      dailyMap[day].total += inv.total || 0;
      dailyMap[day].amountPaid += inv.amountPaid || 0;
    }

    const revenueOverTime: Array<{ date: string; total: number; amountPaid: number }> = [];
    for (let d = 0; d < 30; d++) {
      const date = new Date(now);
      date.setDate(now.getDate() - d);
      const day = date.toISOString().split("T")[0];
      const entry = dailyMap[day] || { total: 0, amountPaid: 0 };
      revenueOverTime.unshift({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        total: entry.total,
        amountPaid: entry.amountPaid,
      });
    }

    // Paid vs Outstanding
    const paidVsOutstanding = {
      paid: invoices.reduce((sum: number, inv: any) => sum + (inv.amountPaid || 0), 0),
      outstanding: outstandingBalance,
    };

    // Overdue breakdown (by invoice, with customer name)
    const overdueBreakdown = overdueInvoices
      .map((inv: any) => {
        const daysOverdue = Math.floor(
          (now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          customerName: inv.customer?.name || inv.customer?.company || "Unknown",
          amount: (inv.total || 0) - (inv.amountPaid || 0),
          daysOverdue,
          invoiceNumber: inv.number,
        };
      })
      .sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);

    // Revenue by customer (top 5 + Others)
    const customerRevenue = invoices.reduce((acc: Record<string, number>, inv: any) => {
      const name = inv.customer?.name || inv.customer?.company || "Unknown";
      acc[name] = (acc[name] || 0) + (inv.total || 0);
      return acc;
    }, {});

    const sortedCustomers = Object.entries(customerRevenue)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount: amount as number }));

    const totalRevenueByTop5 = sortedCustomers.reduce(
      (sum, c) => sum + c.amount,
      0
    );
    const othersAmount = totalRevenue - totalRevenueByTop5;

    const colors = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];
    const revenueByCustomer = sortedCustomers.map((c, i) => ({
      name: c.name,
      amount: c.amount,
      color: colors[i % colors.length],
    }));

    if (othersAmount > 0) {
      revenueByCustomer.push({
        name: "Others",
        amount: othersAmount,
        color: "#9ca3af",
      });
    }

    // Invoice list (all invoices, most recent first)
    const invoiceList = invoices
      .map((inv: any) => {
        const daysOverdue =
          inv.dueDate && new Date(inv.dueDate) < now
            ? Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
        return {
          id: inv.id,
          number: inv.number,
          customerName: inv.customer?.name || inv.customer?.company || "Unknown",
          customerCompany: inv.customer?.company || null,
          amount: (inv.total || 0) - (inv.amountPaid || 0),
          dueDate: inv.dueDate,
          status: inv.status,
          currency: inv.currency || "USD",
          daysOverdue,
        };
      })
      .sort((a: any, b: any) => {
        if (a.daysOverdue > 0 && b.daysOverdue === 0) return -1;
        if (b.daysOverdue > 0 && a.daysOverdue === 0) return 1;
        return new Date(b.dueDate ?? 0).getTime() - new Date(a.dueDate ?? 0).getTime();
      });

    return {
      kpis: {
        totalRevenue,
        outstandingBalance,
        overdueAmount,
        paidThisMonth,
      },
      revenueOverTime,
      paidVsOutstanding,
      overdueBreakdown,
      revenueByCustomer,
      invoices: invoiceList,
    };
  });
}

export async function exportInvoices(format: "csv" | "xlsx") {
  return withActionError("exportInvoices", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    let invoices;
    try {
      invoices = await db.invoice.findMany({
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
        invoices = await db.invoice.findMany({
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

    const data = invoices.map((inv) => ({
      "Invoice #": inv.number,
      "Status": inv.status,
      "Customer": inv.customer?.name ?? "",
      "Customer Email": inv.customer?.email ?? "",
        "Issue Date": inv.issueDate.toISOString().split("T")[0],
        "Due Date": inv.dueDate ? inv.dueDate.toISOString().split("T")[0] : "",
        "Type": inv.type,
        "Subtotal": inv.subtotal,
        "Tax Amount": inv.taxAmount,
        "Discount": inv.discount,
        "Late Fee": (inv as any).lateFeeAmount ?? 0,
        "Total": inv.total,
        "Amount Paid": inv.amountPaid,
        "Balance": inv.total - inv.amountPaid,
        "Currency": inv.currency,
        "Notes": inv.notes ?? "",
    }));

    if (format === "csv") {
      const headers = Object.keys(data[0] || {});
      const rows = data.map((row) =>
        headers.map((h) => {
          const val = row[h as keyof typeof row];
          const str = String(val ?? "");
          return str.includes(",") ? `"${str}"` : str;
        }).join(",")
      );
      const csv = [headers.join(","), ...rows].join("\n");
      return { content: csv, filename: `invoices-${formatDateFn(new Date(), "yyyy-MM-dd")}.csv` };
    }

    const xlsx = await import("xlsx");
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Invoices");
    const buf = xlsx.write(wb, { type: "array", bookType: "xlsx" });
    const base64 = Buffer.from(buf).toString("base64");
    return { content: base64, filename: `invoices-${formatDateFn(new Date(), "yyyy-MM-dd")}.xlsx` };
  });
}
