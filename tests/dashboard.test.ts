import { describe, expect, it } from "vitest";
import { computeDashboardData } from "@/lib/dashboard";
import type {
	DashboardInvoiceInput,
	DashboardPaymentInput,
	DashboardExpenseInput,
	DashboardChangeOrderInput,
	DashboardProjectInput,
} from "@/lib/dashboard";

const NOW = new Date(2024, 8, 15, 10, 0, 0);

function inv(over: Partial<DashboardInvoiceInput> = {}): DashboardInvoiceInput {
	return {
		id: "i1",
		number: "INV-0001",
		total: 10000,
		amountPaid: 0,
		status: "SENT",
		issueDate: new Date(2024, 8, 1),
		dueDate: new Date(2024, 9, 1),
		customerName: "Acme",
		...over,
	};
}

const PROJECTS: DashboardProjectInput[] = [{ id: "p1", name: "Kitchen Remodel", customerName: "Acme" }];

describe("computeDashboardData — stats", () => {
	it("computes money owed from active invoices", () => {
		const d = computeDashboardData({
			invoices: [inv({ total: 10000, amountPaid: 3000, status: "SENT" })],
			payments: [],
			expenses: [],
			changeOrders: [],
			projects: PROJECTS,
			unbilledTotal: 0,
			currency: "USD",
			now: NOW,
		});
		expect(d["stats"]["moneyOwed"])["toBe"](7000);
	});

	it("excludes void/cancelled invoices from money owed", () => {
		const d = computeDashboardData({
			invoices: [
				inv({ id: "i1", total: 10000, status: "SENT" }),
				inv({ id: "i2", total: 5000, status: "VOID" }),
			],
			payments: [],
			expenses: [],
			changeOrders: [],
			projects: PROJECTS,
			unbilledTotal: 0,
			currency: "USD",
			now: NOW,
		});
		expect(d["stats"]["moneyOwed"])["toBe"](10000);
	});

	it("computes overdue from past-due invoices", () => {
		const d = computeDashboardData({
			invoices: [inv({ dueDate: "2024-09-01T00:00:00Z", total: 9250, amountPaid: 0, status: "SENT" })],
			payments: [],
			expenses: [],
			changeOrders: [],
			projects: PROJECTS,
			unbilledTotal: 0,
			currency: "USD",
			now: NOW,
		});
		expect(d["stats"]["overdueAmount"])["toBe"](9250);
	});

	it("does not count future-due invoices as overdue", () => {
		const d = computeDashboardData({
			invoices: [inv({ dueDate: "2024-10-15T00:00:00Z", total: 9250, status: "SENT" })],
			payments: [],
			expenses: [],
			changeOrders: [],
			projects: PROJECTS,
			unbilledTotal: 0,
			currency: "USD",
			now: NOW,
		});
		expect(d["stats"]["overdueAmount"])["toBe"](0);
	});

	it("computes revenue this month from issued invoice totals", () => {
		const d = computeDashboardData({
			invoices: [
				inv({ issueDate: "2024-09-05T00:00:00Z", total: 6500, status: "PAID" }),
				inv({ id: "i2", issueDate: "2024-08-20T00:00:00Z", total: 2000, status: "PAID" }),
			],
			payments: [],
			expenses: [],
			changeOrders: [],
			projects: PROJECTS,
			unbilledTotal: 0,
			currency: "USD",
			now: NOW,
		});
		expect(d["stats"]["revenueThisMonth"])["toBe"](6500);
	});

	it("computes collected this month from payments", () => {
		const d = computeDashboardData({
			invoices: [],
			payments: [
				{ id: "p1", amount: 4200, date: "2024-09-10T00:00:00Z" },
				{ id: "p2", amount: 1000, date: "2024-08-28T00:00:00Z" },
			],
			expenses: [],
			changeOrders: [],
			projects: PROJECTS,
			unbilledTotal: 0,
			currency: "USD",
			now: NOW,
		});
		expect(d["stats"]["collectedThisMonth"])["toBe"](4200);
	});

	it("computes estimated profit = collected - expenses this month", () => {
		const d = computeDashboardData({
			invoices: [],
			payments: [{ id: "p1", amount: 6000, date: "2024-09-10T00:00:00Z" }],
			expenses: [{ id: "e1", amount: 2500, category: "MATERIALS", date: "2024-09-05T00:00:00Z" }],
			changeOrders: [],
			projects: PROJECTS,
			unbilledTotal: 0,
			currency: "USD",
			now: NOW,
		});
		expect(d["stats"]["estimatedProfit"])["toBe"](3500);
	});

	it("aggregates revenue chart over 12 months", () => {
		const d = computeDashboardData({
			invoices: [
				inv({ id: "i1", issueDate: new Date(2024, 1, 10), total: 1000, status: "PAID" }),
				inv({ id: "i2", issueDate: new Date(2024, 8, 1), total: 2000, status: "SENT" }),
			],
			payments: [{ id: "p1", amount: 2000, date: new Date(2024, 8, 10) }],
			expenses: [],
			changeOrders: [],
			projects: PROJECTS,
			unbilledTotal: 0,
			currency: "USD",
			now: NOW,
		});
		expect(d["monthlyRevenue"]["length"])["toBe"](12);
		// September should carry the 2000 invoice revenue
		const sep = d["monthlyRevenue"].find((m) => m["label"].startsWith("Sep"));
		expect(sep?.["revenue"])["toBe"](2000);
		expect(sep?.["collected"])["toBe"](2000);
	});
});

describe("computeDashboardData — attention items", () => {
	it("surfaces unbilled revenue as a high-priority item", () => {
		const d = computeDashboardData({
			invoices: [],
			payments: [],
			expenses: [],
			changeOrders: [],
			projects: PROJECTS,
			unbilledTotal: 14800,
			currency: "USD",
			now: NOW,
		});
		const ub = d["attentionItems"].find((a) => a["id"] === "unbilled");
		expect(ub)["toBeDefined"]();
		expect(ub?.["amount"])["toBe"](14800);
		expect(ub?.["priority"])["toBe"]("high");
		expect(ub?.["actionLabel"])["toBe"]("Review");
	});

	it("surfaces overdue invoices with a send-reminder action", () => {
		const d = computeDashboardData({
			invoices: [inv({ id: "overdue-1", dueDate: "2024-09-01T00:00:00Z", total: 9250, status: "SENT" })],
			payments: [],
			expenses: [],
			changeOrders: [],
			projects: PROJECTS,
			unbilledTotal: 0,
			currency: "USD",
			now: NOW,
		});
		const ov = d["attentionItems"].find((a) => a["id"] === "overdue");
		expect(ov)["toBeDefined"]();
		expect(ov?.["amount"])["toBe"](9250);
		expect(ov?.["actionLabel"])["toBe"]("Send reminder");
	});

	it("surfaces approved change orders not yet billed", () => {
		const d = computeDashboardData({
			invoices: [],
			payments: [],
			expenses: [],
			changeOrders: [
				{ id: "co1", number: "CO-0001", changeAmount: 6500, status: "APPROVED", invoiced: false },
				{ id: "co2", number: "CO-0002", changeAmount: 1000, status: "APPROVED", invoiced: true },
			],
			projects: PROJECTS,
			unbilledTotal: 0,
			currency: "USD",
			now: NOW,
		});
		const co = d["attentionItems"].find((a) => a["id"] === "change-orders");
		expect(co)["toBeDefined"]();
		expect(co?.["amount"])["toBe"](6500);
	});

	it("does not surface change orders that are pending (not approved)", () => {
		const d = computeDashboardData({
			invoices: [],
			payments: [],
			expenses: [],
			changeOrders: [{ id: "co1", number: "CO-0001", changeAmount: 6500, status: "PENDING_APPROVAL", invoiced: false }],
			projects: PROJECTS,
			unbilledTotal: 0,
			currency: "USD",
			now: NOW,
		});
		expect(d["attentionItems"].find((a) => a["id"] === "change-orders"))["toBeUndefined"]();
	});

	it("returns no attention items when everything is clean", () => {
		const d = computeDashboardData({
			invoices: [inv({ total: 0, status: "DRAFT", dueDate: "2024-10-01T00:00:00Z" })],
			payments: [],
			expenses: [],
			changeOrders: [],
			projects: PROJECTS,
			unbilledTotal: 0,
			currency: "USD",
			now: NOW,
		});
		expect(d["attentionItems"])["toEqual"]([]);
	});
});
