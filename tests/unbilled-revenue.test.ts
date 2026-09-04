import { describe, expect, it } from "vitest";
import { computeUnbilledRevenue } from "@/lib/unbilled-revenue";

const P = { id: "p1", name: "Kitchen Remodel", customerName: "Acme Co", currency: "USD" };

describe("computeUnbilledRevenue", () => {
	it("returns an empty summary when nothing is billable", () => {
		const s = computeUnbilledRevenue({
			projects: [P],
			milestones: [],
			changeOrders: [],
			expenses: [],
			timeEntries: [],
		});
		expect(s["total"])["toBe"](0);
		expect(s["items"])["toEqual"]([]);
	});

	it("detects a completed milestone without an invoice", () => {
		const s = computeUnbilledRevenue({
			projects: [P],
			milestones: [{ id: "m1", projectId: "p1", name: "Foundation", amount: 8400, status: "COMPLETED", invoiceId: null }],
			changeOrders: [],
			expenses: [],
			timeEntries: [],
		});
		expect(s["items"]["length"])["toBe"](1);
		expect(s["items"][0]["type"])["toBe"]("completed_milestone");
		expect(s["items"][0]["amount"])["toBe"](8400);
		expect(s["items"][0]["projectName"])["toBe"]("Kitchen Remodel");
		expect(s["total"])["toBe"](8400);
	});

	it("excludes a milestone that is already invoiced", () => {
		const s = computeUnbilledRevenue({
			projects: [P],
			milestones: [{ id: "m1", projectId: "p1", name: "Foundation", amount: 8400, status: "COMPLETED", invoiceId: "inv-1" }],
			changeOrders: [],
			expenses: [],
			timeEntries: [],
		});
		expect(s["items"])["toEqual"]([]);
	});

	it("excludes a pending milestone", () => {
		const s = computeUnbilledRevenue({
			projects: [P],
			milestones: [{ id: "m1", projectId: "p1", name: "Foundation", amount: 8400, status: "PENDING", invoiceId: null }],
			changeOrders: [],
			expenses: [],
			timeEntries: [],
		});
		expect(s["items"])["toEqual"]([]);
	});

	it("detects an approved change order not yet fully invoiced (partial)", () => {
		const s = computeUnbilledRevenue({
			projects: [P],
			milestones: [],
			changeOrders: [{
				id: "co1",
				projectId: "p1",
				number: "CO-0001",
				changeAmount: 3500,
				status: "APPROVED",
				description: "Extra tile",
				invoiced: 1000,
			}],
			expenses: [],
			timeEntries: [],
		});
		expect(s["items"]["length"])["toBe"](1);
		expect(s["items"][0]["type"])["toBe"]("approved_change_order");
		// remaining = 3500 - 1000 = 2500
		expect(s["items"][0]["amount"])["toBe"](2500);
	});

	it("excludes a fully-invoiced approved change order", () => {
		const s = computeUnbilledRevenue({
			projects: [P],
			milestones: [],
			changeOrders: [{
				id: "co1",
				projectId: "p1",
				number: "CO-0001",
				changeAmount: 3500,
				status: "APPROVED",
				invoiced: 3500,
			}],
			expenses: [],
			timeEntries: [],
		});
		expect(s["items"])["toEqual"]([]);
	});

	it("excludes a pending change order (does not affect contract value)", () => {
		const s = computeUnbilledRevenue({
			projects: [P],
			milestones: [],
			changeOrders: [{
				id: "co1",
				projectId: "p1",
				number: "CO-0001",
				changeAmount: 3500,
				status: "PENDING_APPROVAL",
				invoiced: 0,
			}],
			expenses: [],
			timeEntries: [],
		});
		expect(s["items"])["toEqual"]([]);
	});

	it("detects billable expenses not yet invoiced", () => {
		const s = computeUnbilledRevenue({
			projects: [P],
			milestones: [],
			changeOrders: [],
			expenses: [
				{ id: "e1", projectId: "p1", vendor: "Home Depot", category: "MATERIALS", amount: 4200, invoiced: false },
				{ id: "e2", projectId: "p1", vendor: "Acme", category: "SUBCONTRACTOR", amount: 1000, invoiced: true },
			],
			timeEntries: [],
		});
		expect(s["items"]["length"])["toBe"](1);
		expect(s["items"][0]["type"])["toBe"]("billable_expense");
		expect(s["items"][0]["amount"])["toBe"](4200);
	});

	it("detects unbilled billable time", () => {
		const s = computeUnbilledRevenue({
			projects: [P],
			milestones: [],
			changeOrders: [],
			expenses: [],
			timeEntries: [
				{ id: "t1", projectId: "p1", amount: 1200, invoiced: false, description: "Site labor" },
				{ id: "t2", projectId: "p1", amount: 800, invoiced: true, description: "Done" },
			],
		});
		expect(s["items"]["length"])["toBe"](1);
		expect(s["items"][0]["type"])["toBe"]("unbilled_time");
		expect(s["items"][0]["amount"])["toBe"](1200);
	});

	it("aggregates the total across all sources without float drift", () => {
		const s = computeUnbilledRevenue({
			projects: [P],
			milestones: [{ id: "m1", projectId: "p1", name: "A", amount: 8400.0, status: "COMPLETED", invoiceId: null }],
			changeOrders: [{ id: "co1", projectId: "p1", number: "CO-1", changeAmount: 3500, status: "APPROVED", invoiced: 0 }],
			expenses: [{ id: "e1", projectId: "p1", vendor: "X", category: "MATERIALS", amount: 4200, invoiced: false }],
			timeEntries: [{ id: "t1", projectId: "p1", amount: 6500, invoiced: false }],
		});
		// 0.1 + 0.2 drift safety: amounts are whole dollars here but the engine
		// routes through integer cents so sub-cent values would also balance.
		expect(s["total"])["toBe"](8400 + 3500 + 4200 + 6500);
		expect(s["byType"]["completed_milestone"])["toBe"](8400);
		expect(s["byType"]["approved_change_order"])["toBe"](3500);
		expect(s["byType"]["billable_expense"])["toBe"](4200);
		expect(s["byType"]["unbilled_time"])["toBe"](6500);
	});

	it("handles sub-cent amounts without drift", () => {
		const s = computeUnbilledRevenue({
			projects: [P],
			milestones: [],
			changeOrders: [],
			expenses: [
				{ id: "e1", projectId: "p1", vendor: "X", category: "MATERIALS", amount: 0.1, invoiced: false },
				{ id: "e2", projectId: "p1", vendor: "Y", category: "MATERIALS", amount: 0.2, invoiced: false },
			],
			timeEntries: [],
		});
		expect(s["total"])["toBe"](0.3);
	});

	it("attaches the project name even for items with a missing project", () => {
		const s = computeUnbilledRevenue({
			projects: [],
			milestones: [],
			changeOrders: [{ id: "co1", projectId: "pX", number: "CO-1", changeAmount: 1000, status: "APPROVED", invoiced: 0 }],
			expenses: [],
			timeEntries: [],
		});
		expect(s["items"][0]["projectName"])["toBe"]("—");
		expect(s["total"])["toBe"](1000);
	});

	it("skips items with zero or negative amount", () => {
		const s = computeUnbilledRevenue({
			projects: [P],
			milestones: [{ id: "m1", projectId: "p1", name: "Zero", amount: 0, status: "COMPLETED", invoiceId: null }],
			changeOrders: [{ id: "co1", projectId: "p1", number: "CO-1", changeAmount: -5, status: "APPROVED", invoiced: 0 }],
			expenses: [],
			timeEntries: [],
		});
		expect(s["items"])["toEqual"]([]);
	});
});
