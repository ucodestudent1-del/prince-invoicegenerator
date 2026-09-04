"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { isMissingColumnError } from "@/lib/db-drift";
import { withActionError } from "@/lib/action-errors";
import { computeDashboardData, type DashboardDerived, type DashboardInvoiceInput } from "@/lib/dashboard";
import { getUnbilledRevenue } from "@/lib/actions/unbilled-revenue";

export interface DashboardData extends DashboardDerived {
	recentInvoices: DashboardInvoiceInput[];
}

/**
 * Fetch the rows the dashboard needs and derive the dashboard view model.
 *
 * All DB access for the dashboard lives here per the `lib/dashboard.ts`
 * contract. Monetary math is delegated to `computeDashboardData`; this module
 * is only responsible for turning Prisma rows into `Dashboard*Input` shapes.
 *
 * Currency is an organization-level single source of truth (projects,
 * expenses, milestones and change-order detection live in org currency), so
 * every derived input is stamped with the org's currency.
 */
export async function getDashboardData(): Promise<DashboardData> {
	return withActionError("getDashboardData", async () => {
		const user = await requireUser();
		if (!user["organizationId"]) throw new Error("No organization");
		const orgId = user["organizationId"];

		// Org currency (single source).
		let orgCurrency = "USD";
		try {
			const org = await db["organization"]["findUnique"]({
				where: { id: orgId },
				select: { currency: true },
			});
			orgCurrency = org?.["currency"] ?? "USD";
		} catch (err) {
			if (!isMissingColumnError(err)) throw err;
		}

		const [invoiceRows, paymentRows, expenseRows, changeOrderRows, unbilledSummary] = await Promise.all([
			fetchInvoices(orgId, orgCurrency),
			fetchPayments(orgId, orgCurrency),
			fetchExpenses(orgId, orgCurrency),
			fetchChangeOrders(orgId, orgCurrency),
			fetchUnbilledTotal(orgId),
		]);

		const derived = computeDashboardData({
			invoices: invoiceRows,
			payments: paymentRows,
			expenses: expenseRows,
			changeOrders: changeOrderRows,
			projects: [],
			unbilledTotal: unbilledSummary,
			currency: orgCurrency,
			now: new Date(),
		});

		return { ...derived, recentInvoices: invoiceRows };
	});
}

async function fetchInvoices(orgId: string, currency: string) {
	const rows = await db["invoice"]["findMany"]({
		where: { orgId },
		select: {
			id: true,
			number: true,
			total: true,
			amountPaid: true,
			status: true,
			issueDate: true,
			dueDate: true,
			currency: true,
			customer: { select: { name: true, company: true } },
			project: { select: { name: true } },
		},
		orderBy: { createdAt: "desc" },
		take: 15,
	});
	return rows.map((inv) => ({
		id: inv["id"],
		number: inv["number"],
		total: Number(inv["total"] ?? 0),
		amountPaid: Number(inv["amountPaid"] ?? 0),
		status: inv["status"],
		issueDate: inv["issueDate"],
		dueDate: inv["dueDate"] ?? null,
		customerName: inv["customer"]?.["name"] ?? inv["customer"]?.["company"] ?? null,
		projectName: inv["project"]?.["name"] ?? null,
		currency: inv["currency"] ?? currency,
	}));
}

async function fetchPayments(orgId: string, currency: string) {
	const rows = await db["payment"]["findMany"]({
		where: { orgId, paymentDate: { not: null } },
		select: {
			id: true,
			amount: true,
			paymentDate: true,
			currency: true,
			invoice: {
				select: {
					number: true,
					customer: { select: { name: true, company: true } },
				},
			},
		},
		orderBy: { createdAt: "desc" },
		take: 15,
	});
	return rows.map((p) => ({
		id: p["id"],
		amount: Number(p["amount"] ?? 0),
		date: p["paymentDate"] ?? new Date(),
		invoiceNumber: p["invoice"]?.["number"] ?? null,
		customerName: p["invoice"]?.["customer"]?.["name"] ?? p["invoice"]?.["customer"]?.["company"] ?? null,
		currency: p["currency"] ?? currency,
	}));
}

async function fetchExpenses(orgId: string, currency: string) {
	const rows = await db["expense"]["findMany"]({
		where: { orgId },
		select: {
			id: true,
			vendor: true,
			category: true,
			amount: true,
			date: true,
			projectId: true,
		},
		orderBy: { createdAt: "desc" },
		take: 10,
	});
	return rows.map((e) => ({
		id: e["id"],
		vendor: e["vendor"],
		category: e["category"],
		amount: Number(e["amount"] ?? 0),
		date: e["date"],
		projectId: e["projectId"],
		currency,
	}));
}

async function fetchChangeOrders(orgId: string, currency: string) {
	const rows = await db["changeOrder"]["findMany"]({
		where: { orgId, status: "APPROVED", invoiceId: null },
		select: {
			id: true,
			number: true,
			changeAmount: true,
			status: true,
			projectId: true,
		},
		orderBy: { updatedAt: "desc" },
		take: 10,
	});
	return rows.map((co) => ({
		id: co["id"],
		number: co["number"],
		changeAmount: Number(co["changeAmount"] ?? 0),
		status: co["status"],
		projectId: co["projectId"],
		invoiced: false,
	}));
}

/**
 * Reuses the existing unbilled-revenue engine so the dashboard's "potentially
 * unbilled revenue" figure stays consistent with the dedicated page. Best
 * effort: a failure to compute unbilled revenue must not take down the whole
 * dashboard.
 */
async function fetchUnbilledTotal(orgId: string): Promise<number> {
	try {
		const summary = await getUnbilledRevenue();
		return Number(summary?.["total"] ?? 0);
	} catch (err) {
		return 0;
	}
}
