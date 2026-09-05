"use server";

import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { isMissingColumnError } from "@/lib/db-drift";
import { withActionError } from "@/lib/action-errors";
import { computeDashboardData, type DashboardDerived, type DashboardInvoiceInput } from "@/lib/dashboard";
import { DASHBOARD_CACHE_TTL_SECONDS, dashboardCacheTag } from "@/lib/dashboard-cache";
import { logServerError } from "@/lib/errors";

export interface DashboardData extends DashboardDerived {
	recentInvoices: DashboardInvoiceInput[];
	/** BCP-47 tag for `Intl.NumberFormat` / `Intl.DateTimeFormat` (org's numberFormat). */
	locale: string;
}

/**
 * Invalidate the dashboard cache for an organization. Call from any server
 * action that mutates invoices, payments, expenses, or change orders so the
 * next dashboard render shows fresh numbers.
 */
export async function invalidateDashboard(orgId: string) {
	revalidateTag(dashboardCacheTag(orgId));
}

/**
 * Fetch the rows the dashboard needs and derive the dashboard view model.
 *
 * The dynamic (per-request) part of the pipeline — auth/session — is resolved
 * outside the cache. The cache scope receives a primitive (`orgId`) so it
 * never touches `headers()` / `cookies()` and never trips Next.js'
 * "dynamic data in a cached function" error.
 */
export async function getDashboardData(): Promise<DashboardData> {
	return withActionError("getDashboardData", async () => {
		// requireUser() uses cookies()/headers() internally; it MUST be outside
		// the cached function or Next.js will throw a runtime error.
		const user = await requireUser();
		if (!user["organizationId"]) throw new Error("No organization");
		const orgId = user["organizationId"];

		return loadCachedDashboard(orgId);
	});
}

async function loadCachedDashboard(orgId: string): Promise<DashboardData> {
	const fetcher = unstable_cache(
		async () => loadDashboardFromDb(orgId),
		["dashboard-data", orgId],
		{
			tags: [dashboardCacheTag(orgId)],
			revalidate: DASHBOARD_CACHE_TTL_SECONDS,
		}
	);
	return fetcher();
}

async function loadDashboardFromDb(orgId: string): Promise<DashboardData> {
	// Org-level display settings (single source).
	let orgCurrency = "USD";
	let orgNumberFormat = "en-US";
	try {
		const org = await db["organization"]["findUnique"]({
			where: { id: orgId },
			select: { currency: true, numberFormat: true },
		});
		orgCurrency = org?.["currency"] ?? "USD";
		orgNumberFormat = org?.["numberFormat"] ?? "en-US";
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

	return { ...derived, recentInvoices: invoiceRows, locale: orgNumberFormat };
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
			updatedAt: true,
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
		updatedAt: co["updatedAt"] ?? new Date(),
	}));
}

/**
 * Compute a cheap "unbilled revenue" total from the same rows the dashboard
 * already pulls. This deliberately inlines a small computation so the cached
 * data layer can stay free of dynamic calls (Server Actions, headers, cookies).
 *
 * A failure here is non-fatal: the dashboard renders without an unbilled
 * total and the dedicated Unbilled Revenue page remains the source of truth.
 */
async function fetchUnbilledTotal(orgId: string): Promise<number> {
	try {
		// Approved change orders whose net delta is not yet invoiced.
		const changeOrders = await db["changeOrder"].findMany({
			where: { orgId, status: "APPROVED", invoiceId: null },
			select: { changeAmount: true },
		});
		const changeOrderTotal = changeOrders.reduce(
			(sum, co) => sum + Number(co["changeAmount"] ?? 0),
			0
		);

		// Completed project milestones that have not been invoiced. Tolerate a
		// missing ProjectMilestone table or MilestoneStatus type so the dashboard
		// still renders on a drifted database.
		let milestoneTotal = 0;
		try {
			const milestones = await db["projectMilestone"].findMany({
				where: { orgId, status: "COMPLETED", invoiceId: null },
				select: { amount: true },
			});
			milestoneTotal = milestones.reduce(
				(sum, m) => sum + Number(m["amount"] ?? 0),
				0
			);
		} catch (err) {
			if (!isMissingColumnError(err)) throw err;
		}

		// Billable expenses assigned to a project that are not yet invoiced.
		// The Expense model has no `invoiced` flag, so we approximate by
		// including all billable expenses assigned to a project. The dedicated
		// Unbilled Revenue page does the rigorous per-line calculation.
		const expenses = await db["expense"].findMany({
			where: { orgId, projectId: { not: null } },
			select: { amount: true },
		});
		const expenseTotal = expenses.reduce(
			(sum, e) => sum + Number(e["amount"] ?? 0),
			0
		);

		return Math.max(0, changeOrderTotal + milestoneTotal + expenseTotal);
	} catch (err) {
		logServerError("Dashboard.fetchUnbilledTotal", err);
		return 0;
	}
}
