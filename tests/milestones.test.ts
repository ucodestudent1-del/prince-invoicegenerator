import { describe, expect, it } from "vitest";
import {
	computeMilestoneSummary,
	getUnbilledMilestones,
	effectiveMilestoneStatus,
} from "@/lib/milestones";
import type { MilestoneInput } from "@/lib/milestones";

const M = (over: Partial<MilestoneInput> = {}): MilestoneInput => ({
	id: "m1",
	projectId: "p1",
	name: "Foundation",
	amount: 5000,
	status: "PENDING",
	...over,
});

describe("computeMilestoneSummary", () => {
	it("aggregates by status", () => {
		const ms = [
			M({ id: "a", amount: 1000, status: "PENDING" }),
			M({ id: "b", amount: 2000, status: "COMPLETED" }),
			M({ id: "c", amount: 3000, status: "INVOICED" }),
			M({ id: "d", amount: 500, status: "CANCELLED" }),
		];
		const s = computeMilestoneSummary(ms);
		expect(s["total"])["toBe"](6500);
		expect(s["pending"])["toBe"](1000);
		expect(s["completed"])["toBe"](2000);
		expect(s["invoiced"])["toBe"](3000);
		expect(s["cancelled"])["toBe"](500);
	});

	it("reports completed-but-unbilled as completedNotInvoiced", () => {
		const ms = [
			M({ id: "a", amount: 2000, status: "COMPLETED" }),
			M({ id: "b", amount: 1500, status: "COMPLETED", invoiceId: "inv-1" }),
		];
		const s = computeMilestoneSummary(ms);
		expect(s["completed"])["toBe"](3500);
		expect(s["invoiced"])["toBe"](1500);
		expect(s["completedNotInvoiced"])["toBe"](2000);
	});

	it("progress is invoiced / total", () => {
		const ms = [
			M({ id: "a", amount: 1000, status: "COMPLETED" }),
			M({ id: "b", amount: 1000, status: "COMPLETED", invoiceId: "inv-1" }),
		];
		const s = computeMilestoneSummary(ms);
		expect(s["progressPercent"])["toBe"](50);
	});

	it("progress is 0 when no milestones", () => {
		expect(computeMilestoneSummary([])["progressPercent"])["toBe"](0);
	});

	it("progress is 0 when total is 0", () => {
		const s = computeMilestoneSummary([M({ id: "a", amount: 0, status: "INVOICED" })]);
		expect(s["progressPercent"])["toBe"](0);
	});
});

describe("getUnbilledMilestones", () => {
	it("returns only completed, un-invoiced milestones", () => {
		const ms = [
			M({ id: "a", amount: 2000, status: "COMPLETED" }),
			M({ id: "b", amount: 3000, status: "COMPLETED", invoiceId: "inv-1" }),
			M({ id: "c", amount: 1000, status: "PENDING" }),
		];
		const unbilled = getUnbilledMilestones(ms);
		expect(unbilled["length"])["toBe"](1);
		expect(unbilled[0]["id"])["toBe"]("a");
	});

	it("sorts by due date ascending; milestones with no due date sort last", () => {
		const ms = [
			M({ id: "late", amount: 500, status: "COMPLETED", dueDate: new Date("2024-03-01") }),
			M({ id: "early", amount: 300, status: "COMPLETED", dueDate: new Date("2024-01-01") }),
			M({ id: "nodate", amount: 200, status: "COMPLETED" }),
		];
		const unbilled = getUnbilledMilestones(ms);
		expect(unbilled.map((m) => m["id"]))["toEqual"](["early", "late", "nodate"]);
	});
});

describe("effectiveMilestoneStatus", () => {
	it("marks a completed milestone with an invoice as INVOICED", () => {
		expect(effectiveMilestoneStatus(M({ status: "COMPLETED", invoiceId: "inv-1" })))["toBe"]("INVOICED");
	});

	it("keeps a completed milestone without an invoice as COMPLETED", () => {
		expect(effectiveMilestoneStatus(M({ status: "COMPLETED", invoiceId: null })))["toBe"]("COMPLETED");
	});

	it("passes through CANCELLED", () => {
		expect(effectiveMilestoneStatus(M({ status: "CANCELLED" })))["toBe"]("CANCELLED");
	});

	it("passes through PENDING", () => {
		expect(effectiveMilestoneStatus(M({ status: "PENDING" })))["toBe"]("PENDING");
	});

	it("a COMPLETED milestone whose invoiceId was cleared re-reads as COMPLETED", () => {
		expect(effectiveMilestoneStatus(M({ status: "COMPLETED", invoiceId: undefined })))["toBe"]("COMPLETED");
	});
});
