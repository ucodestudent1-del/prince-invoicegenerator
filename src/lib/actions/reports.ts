"use server";

import { format as formatDateFn } from "date-fns";
import { db } from "@/lib/db";
import { requireUser, isMissingColumnError } from "@/lib/org";
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
