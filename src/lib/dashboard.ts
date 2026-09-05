/**
 * Dashboard aggregation logic (pure).
 *
 * The dashboard exists to answer three questions for a construction contractor:
 *
 *   1. What is happening?        -> Revenue/Collected/Estimated-Profit cards + chart
 *   2. What needs my attention?  -> Overdue, unbilled revenue, change orders, costs
 *   3. What should I do next?     -> direct, actionable primary buttons
 *
 * All DB access lives in `lib/actions/dashboard.ts`; this module turns already
 * fetched rows into the derived values the UI renders. Keeping it pure makes
 * the alert/aggregation rules unit-testable.
 */

import { roundMoney, sumMoney } from "@/lib/money";

const ACTIVE_INVOICE_STATUSES = new Set(["DRAFT", "SENT", "VIEWED", "PARTIALLY_PAID", "PAID", "OVERDUE"]);

export interface DashboardInvoiceInput {
	id: string;
	number: string;
	total: number;
	amountPaid: number;
	status: string;
	issueDate: Date | string;
	dueDate: Date | string | null;
	customerName?: string | null;
	projectName?: string | null;
	currency?: string;
}

export interface DashboardPaymentInput {
	id: string;
	amount: number;
	date: Date | string;
	invoiceNumber?: string | null;
	customerName?: string | null;
	currency?: string;
}

export interface DashboardExpenseInput {
	id: string;
	amount: number;
	category: string;
	vendor?: string | null;
	date: Date | string;
	projectId?: string | null;
	currency?: string;
}

export interface DashboardChangeOrderInput {
	id: string;
	number: string;
	changeAmount: number;
	status: string;
	projectId?: string | null;
	invoiced: boolean;
	updatedAt?: Date | string;
}

export interface DashboardProjectInput {
	id: string;
	name: string;
	customerName?: string | null;
}

export interface DashboardStats {
	moneyOwed: number;
	overdueAmount: number;
	revenueThisMonth: number;
	collectedThisMonth: number;
	estimatedProfit: number;
	currency: string;
}

export interface AttentionItem {
	id: string;
	title: string;
	amount: number;
	currency: string;
	priority: "high" | "medium" | "low";
	actionLabel: string;
	actionHref: string;
}

export interface MonthlyPoint {
	label: string;
	revenue: number;
	collected: number;
}

export interface DashboardDerived {
	stats: DashboardStats;
	attentionItems: AttentionItem[];
	monthlyRevenue: MonthlyPoint[];
	recentActivity: {
		id: string;
		type: string;
		title: string;
		/** Optional second-line detail. */
		subtitle?: string;
		/** Money amount in the org currency. */
		amount?: number;
		/** Event date (drives the feed's chronological order). */
		date: Date;
		/** Hint for the UI: "paid" hides the zero-outstanding footgun. */
		paid?: boolean;
	}[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Compute the dashboard stats and "Needs Your Attention" items from fetched rows.
 *
 * `unbilledTotal` is supplied by the Unbilled Revenue engine so this module
 * stays decoupled from the milestone/change-order/expense detection rules.
 */
export function computeDashboardData(input: {
	invoices: DashboardInvoiceInput[];
	payments: DashboardPaymentInput[];
	expenses: DashboardExpenseInput[];
	changeOrders: DashboardChangeOrderInput[];
	projects: DashboardProjectInput[];
	unbilledTotal: number;
	currency: string;
	now?: Date;
}): DashboardDerived {
	const now = input["now"] ?? new Date();
	const currency = input["currency"];
	const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
	const thisMonthStart = firstOfMonth(now);

	const invoices = input["invoices"];

	// Money Owed: outstanding balance on active, non-draft invoices.
	const moneyOwed = sumMoney(
		invoices
			.filter((inv) => ACTIVE_INVOICE_STATUSES["has"](inv["status"]))
			.map((inv) => Math.max(0, roundMoney(inv["total"]) - roundMoney(inv["amountPaid"])))
	);

	// Overdue: outstanding balance on invoices past their due date.
	const overdueInvoices = invoices.filter((inv) => {
		if (!ACTIVE_INVOICE_STATUSES["has"](inv["status"])) return false;
		const due = inv["dueDate"] ? new Date(inv["dueDate"]) : null;
		if (!due || due >= now) return false;
		return roundMoney(inv["total"]) - roundMoney(inv["amountPaid"]) > 0.01;
	});
	const overdueAmount = sumMoney(
		overdueInvoices.map((inv) => roundMoney(inv["total"]) - roundMoney(inv["amountPaid"]))
	);

	// Revenue This Month: totals of invoices issued (and not draft/void) this month.
	const revenueThisMonth = sumMoney(
		invoices
			.filter((inv) => ACTIVE_INVOICE_STATUSES["has"](inv["status"]))
			.filter((inv) => new Date(inv["issueDate"]) >= thisMonthStart)
			.map((inv) => roundMoney(inv["total"]))
	);

	// Collected This Month: payments received this month.
	const collectedThisMonth = sumMoney(
		input["payments"]
			.filter((p) => new Date(p["date"]) >= thisMonthStart)
			.map((p) => roundMoney(p["amount"]))
	);

	// Expenses This Month (direct job costs: materials, labor, subcontractors,
	// equipment). These are subtracted from collected cash to estimate profit.
	const expensesThisMonth = sumMoney(
		input["expenses"]
			.filter((e) => new Date(e["date"]) >= thisMonthStart)
			.map((e) => roundMoney(e["amount"]))
	);

	const estimatedProfit = roundMoney(collectedThisMonth - expensesThisMonth);

	// Approved change orders not yet invoiced.
	const unbilledChangeOrders = input["changeOrders"].filter(
		(co) => co["status"] === "APPROVED" && !co["invoiced"]
	);
	const unbilledChangeOrderTotal = sumMoney(unbilledChangeOrders.map((co) => roundMoney(co["changeAmount"])));

	const attentionItems: AttentionItem[] = [];

	if (input["unbilledTotal"] > 0) {
		attentionItems.push({
			id: "unbilled",
			title: "Potentially unbilled revenue",
			amount: roundMoney(input["unbilledTotal"]),
			currency,
			priority: "high",
			actionLabel: "Review",
			actionHref: "/dashboard/unbilled-revenue",
		});
	}

	if (overdueAmount > 0) {
		attentionItems.push({
			id: "overdue",
			title: `${overdueInvoices.length} overdue invoice${overdueInvoices.length === 1 ? "" : "s"}`,
			amount: roundMoney(overdueAmount),
			currency,
			priority: "high",
			actionLabel: "Send reminder",
			actionHref: `/dashboard/invoices/${overdueInvoices[0]?.["id"] ?? ""}`,
		});
	}

	if (unbilledChangeOrderTotal > 0) {
		attentionItems.push({
			id: "change-orders",
			title: `${unbilledChangeOrders.length} approved change order${unbilledChangeOrders.length === 1 ? "" : "s"}`,
			amount: roundMoney(unbilledChangeOrderTotal),
			currency,
			priority: "medium",
			actionLabel: "Add to next invoice",
			actionHref: "/dashboard/change-orders",
		});
	}

	// "Money currently owed" is the same money as the overdue item above when
	// there are any past-due invoices, so showing both wastes an attention
	// slot. Only surface it as a distinct item when nothing is overdue but
	// money is still outstanding (e.g. future-due invoices).
	if (moneyOwed > 0 && overdueAmount <= 0) {
		attentionItems.push({
			id: "owed",
			title: "Money currently owed",
			amount: roundMoney(moneyOwed),
			currency,
			priority: "medium",
			actionLabel: "Create invoice",
			actionHref: "/dashboard/invoices/new",
		});
	}

	// Monthly revenue chart (last 12 months).
	const monthlyRevenue = buildMonthlyRevenue(invoices, input["payments"], now, currency);

	const recentActivity = buildRecentActivity(invoices, input["payments"], input["expenses"], input["changeOrders"], now, currency);

	return {
		stats: {
			moneyOwed: roundMoney(moneyOwed),
			overdueAmount: roundMoney(overdueAmount),
			revenueThisMonth: roundMoney(revenueThisMonth),
			collectedThisMonth: roundMoney(collectedThisMonth),
			estimatedProfit,
			currency,
		},
		attentionItems,
		monthlyRevenue,
		recentActivity,
	};
}

function buildMonthlyRevenue(
	invoices: DashboardInvoiceInput[],
	payments: DashboardPaymentInput[],
	now: Date,
	currency: string
): MonthlyPoint[] {
	const months: MonthlyPoint[] = [];
	for (let i = 11; i >= 0; i--) {
		const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
		const start = new Date(d.getFullYear(), d.getMonth(), 1);
		const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
		const revenue = sumMoney(
			invoices
				.filter((inv) => ACTIVE_INVOICE_STATUSES["has"](inv["status"]))
				.filter((inv) => {
					const issue = new Date(inv["issueDate"]);
					return issue >= start && issue < end;
				})
				.map((inv) => roundMoney(inv["total"]))
		);
		const collected = sumMoney(
			payments
				.filter((p) => {
					const paid = new Date(p["date"]);
					return paid >= start && paid < end;
				})
				.map((p) => roundMoney(p["amount"]))
		);
		months.push({
			label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`.slice(0, 8),
			revenue,
			collected,
		});
	}
	return months;
}

function buildRecentActivity(
	invoices: DashboardInvoiceInput[],
	payments: DashboardPaymentInput[],
	expenses: DashboardExpenseInput[],
	changeOrders: DashboardChangeOrderInput[],
	now: Date,
	currency: string
) {
	const events: {
		id: string;
		type: string;
		title: string;
		subtitle?: string;
		amount?: number;
		date: Date;
		paid?: boolean;
	}[] = [];

	invoices.slice(0, 5).forEach((inv) => {
		const outstanding = roundMoney(inv.total) - roundMoney(inv.amountPaid);
		events.push({
			id: `inv:${inv.id}`,
			type: "invoice",
			title: `Invoice ${inv.number} ${inv.status}`,
			subtitle: inv.customerName ?? undefined,
			amount: outstanding > 0 ? outstanding : 0,
			date: new Date(inv.issueDate),
			// Paid invoices still appear in the activity feed but the UI hides
			// the $0.00 "outstanding" amount that would otherwise confuse.
			paid: inv.status === "PAID",
		});
	});

	payments.slice(0, 5).forEach((p) => {
		events.push({
			id: `pay:${p.id}`,
			type: "payment",
			title: `Payment received${p.invoiceNumber ? ` for ${p.invoiceNumber}` : ""}`,
			subtitle: p.customerName ?? undefined,
			amount: roundMoney(p.amount),
			date: new Date(p.date),
		});
	});

	expenses.slice(0, 3).forEach((e) => {
		events.push({
			id: `exp:${e.id}`,
			type: "expense",
			title: `${e.vendor ?? e.category} expense`,
			amount: roundMoney(e.amount),
			date: new Date(e.date),
		});
	});

	changeOrders.slice(0, 3).forEach((co) => {
		// Use the change order's own updatedAt when available. Without it, all
		// change-order events end up with the same timestamp and cluster at the
		// top of the feed, which is misleading.
		const eventDate = co.updatedAt ? new Date(co.updatedAt) : now;
		events.push({
			id: `co:${co.id}`,
			type: "change_order",
			title: `Change order ${co.number} ${co.status}`,
			amount: roundMoney(co.changeAmount),
			date: eventDate,
		});
	});

	return events
		.sort((a, b) => b.date.getTime() - a.date.getTime())
		.slice(0, 8);
}
