/**
 * Unbilled Revenue detection engine.
 *
 * Contractors lose money when billable work is never invoiced. This module is
 * the single source of truth for "what has been earned but not yet billed"
 * across four sources:
 *
 *  1. COMPLETED project milestones that have no linked invoice.
 *  2. APPROVED change orders whose net delta has not been fully invoiced.
 *  3. BILLABLE expenses not assigned to any invoice (materials, sub labor, etc.).
 *  4. BILLABLE time entries that have not been invoiced.
 *
 * Every dollar is accumulated in integer cents (see `money.ts`) so that the
 * total never drifts by a sub-cent.
 *
 * This is a *pure* function: it takes already-queried inputs and returns a
 * typed list. The database access lives in the server action layer so this
 * module is fully unit-testable without Postgres.
 */

import { sumMoney, roundMoney } from "@/lib/money";
import type { MilestoneInput } from "@/lib/milestones";

export type UnbilledReason =
	| "completed_milestone"
	| "approved_change_order"
	| "billable_expense"
	| "unbilled_time";

export interface UnbilledProjectInput {
	id: string;
	name: string;
	number?: string | null;
	customerName?: string | null;
	currency?: string;
}

export interface UnbilledMilestoneInput extends MilestoneInput {
	projectId: string;
	currency?: string | null;
}

export interface UnbilledChangeOrderInput {
	id: string;
	projectId: string;
	number: string;
	changeAmount: number;
	status: string;
	description?: string | null;
	/** Total of all invoices already generated from this change order. */
	invoiced: number;
	currency?: string | null;
}

export interface UnbilledExpenseInput {
	id: string;
	projectId: string;
	vendor?: string | null;
	category: string;
	amount: number;
	date?: Date | string | null;
	description?: string | null;
	invoiced: boolean;
	currency?: string | null;
}

export interface UnbilledTimeInput {
	id: string;
	projectId: string;
	description?: string | null;
	amount: number;
	invoiced: boolean;
	currency?: string | null;
}

export interface UnbilledRevenueItem {
	id: string;
	type: UnbilledReason;
	projectId: string;
	projectName: string;
	customerName?: string | null;
	amount: number;
	currency: string;
	reason: string;
	recommendedAction: string;
	/** Original record, for the Review side panel. */
	sourceId: string;
	sourceNumber?: string | null;
	detail?: string | null;
}

export interface UnbilledRevenueSummary {
	items: UnbilledRevenueItem[];
	total: number;
	currency: string;
	byType: Record<UnbilledReason, number>;
}

const ACTION_BY_TYPE: Record<UnbilledReason, string> = {
	completed_milestone: "Create progress invoice",
	approved_change_order: "Add to next invoice",
	billable_expense: "Reimburse or include on invoice",
	unbilled_time: "Bill time on an invoice",
};

function reasonByType(t: UnbilledReason, detail?: string | null): string {
	const suffix = detail ? `: ${detail}` : "";
	switch (t) {
		case "completed_milestone":
			return `Completed milestone not yet invoiced${suffix}`;
		case "approved_change_order":
			return `Approved change order not yet billed${suffix}`;
		case "billable_expense":
			return `Billable expense not yet invoiced${suffix}`;
		case "unbilled_time":
			return "Unbilled billable time";
	}
}

function zeroBuckets(): Record<UnbilledReason, number> {
	return {
		completed_milestone: 0,
		approved_change_order: 0,
		billable_expense: 0,
		unbilled_time: 0,
	};
}

export function computeUnbilledRevenue(input: {
	projects: UnbilledProjectInput[];
	milestones: UnbilledMilestoneInput[];
	changeOrders: UnbilledChangeOrderInput[];
	expenses: UnbilledExpenseInput[];
	timeEntries: UnbilledTimeInput[];
}): UnbilledRevenueSummary {
	const projectMap = new Map(input["projects"].map((p) => [p["id"], p]));
	const byType = zeroBuckets();
	const items: UnbilledRevenueItem[] = [];

	// 1. Completed milestones without an invoice.
	for (const m of input["milestones"]) {
		if (m["status"] !== "COMPLETED" || m["invoiceId"] != null) continue;
		const proj = projectMap.get(m["projectId"]);
		const amount = roundMoney(m["amount"]);
		if (amount <= 0) continue;
		byType["completed_milestone"] = sumMoney([byType["completed_milestone"], amount]);
		items.push({
			id: `milestone:${m["id"]}`,
			type: "completed_milestone",
			projectId: m["projectId"],
			projectName: proj?.["name"] ?? "—",
			customerName: proj?.["customerName"] ?? null,
			amount,
			currency: m["currency"] ?? proj?.["currency"] ?? "USD",
			reason: reasonByType("completed_milestone", m["name"]),
			recommendedAction: ACTION_BY_TYPE["completed_milestone"],
			sourceId: m["id"],
			sourceNumber: null,
			detail: m["name"],
		});
	}

	// 2. Approved change orders whose amount is not fully invoiced.
	for (const co of input["changeOrders"]) {
		if (co["status"] !== "APPROVED") continue;
		const remaining = roundMoney(Math.max(0, co["changeAmount"] - co["invoiced"]));
		if (remaining <= 0) continue;
		const proj = projectMap.get(co["projectId"]) ?? projectMap.get("");
		byType["approved_change_order"] = sumMoney([byType["approved_change_order"], remaining]);
		items.push({
			id: `co:${co["id"]}`,
			type: "approved_change_order",
			projectId: co["projectId"],
			projectName: proj?.["name"] ?? "—",
			customerName: proj?.["customerName"] ?? null,
			amount: remaining,
			currency: co["currency"] ?? proj?.["currency"] ?? "USD",
			reason: reasonByType("approved_change_order", co["description"]),
			recommendedAction: ACTION_BY_TYPE["approved_change_order"],
			sourceId: co["id"],
			sourceNumber: co["number"],
			detail: co["description"],
		});
	}

	// 3. Billable expenses not yet invoiced.
	for (const e of input["expenses"]) {
		if (e["invoiced"]) continue;
		const proj = projectMap.get(e["projectId"]) ?? projectMap.get("");
		const amt = roundMoney(e["amount"]);
		if (amt <= 0) continue;
		byType["billable_expense"] = sumMoney([byType["billable_expense"], amt]);
		items.push({
			id: `exp:${e["id"]}`,
			type: "billable_expense",
			projectId: e["projectId"],
			projectName: proj?.["name"] ?? "—",
			customerName: proj?.["customerName"] ?? null,
			amount: amt,
			currency: e["currency"] ?? proj?.["currency"] ?? "USD",
			reason: reasonByType("billable_expense", e["vendor"] ?? e["description"]),
			recommendedAction: ACTION_BY_TYPE["billable_expense"],
			sourceId: e["id"],
			sourceNumber: null,
			detail: e["vendor"] ?? e["description"],
		});
	}

	// 4. Unbilled billable time.
	for (const t of input["timeEntries"]) {
		if (t["invoiced"]) continue;
		const proj = projectMap.get(t["projectId"]) ?? projectMap.get("");
		const amt = roundMoney(t["amount"]);
		if (amt <= 0) continue;
		byType["unbilled_time"] = sumMoney([byType["unbilled_time"], amt]);
		items.push({
			id: `time:${t["id"]}`,
			type: "unbilled_time",
			projectId: t["projectId"],
			projectName: proj?.["name"] ?? "—",
			customerName: proj?.["customerName"] ?? null,
			amount: amt,
			currency: t["currency"] ?? proj?.["currency"] ?? "USD",
			reason: reasonByType("unbilled_time", t["description"]),
			recommendedAction: ACTION_BY_TYPE["unbilled_time"],
			sourceId: t["id"],
			sourceNumber: null,
			detail: t["description"],
		});
	}

	const total = sumMoney(items.map((i) => i["amount"]));

	return {
		items,
		total,
		currency: input["projects"][0]?.["currency"] ?? "USD",
		byType,
	};
}
