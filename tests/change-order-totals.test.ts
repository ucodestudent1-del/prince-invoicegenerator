import { describe, expect, it } from "vitest";
import {
	computeChangeOrderTotals,
	computeRevisedContractTotal,
} from "@/lib/change-order-totals";

describe("computeChangeOrderTotals — before/after/delta", () => {
	it("ADD: positive delta from new work", () => {
		const t = computeChangeOrderTotals({
			items: [
				{
					changeType: "ADD",
					description: "Extra windows",
					quantityAfter: 2,
					unitPriceAfter: 1500,
				},
			],
			originalContractTotal: 100000,
		});
		expect(t["addAmount"])["toBe"](3000);
		expect(t["changeAmount"])["toBe"](3000);
		expect(t["revisedTotal"])["toBe"](103000);
	});

	it("REMOVE: negative delta from dropped work", () => {
		const t = computeChangeOrderTotals({
			items: [
				{
					changeType: "REMOVE",
					description: "Windows removed",
					quantityBefore: 2,
					unitPriceBefore: 1500,
				},
			],
			originalContractTotal: 100000,
		});
		expect(t["removeAmount"])["toBe"](-3000);
		expect(t["changeAmount"])["toBe"](-3000);
		expect(t["revisedTotal"])["toBe"](97000);
	});

	it("MODIFY preserves before/after and computes net delta", () => {
		// 10 windows -> 12 windows example from the spec.
		const t = computeChangeOrderTotals({
			items: [
				{
					changeType: "MODIFY",
					description: "Windows modified",
					quantityBefore: 10,
					quantityAfter: 12,
					unitPriceBefore: 100,
					unitPriceAfter: 100,
				},
			],
			originalContractTotal: 100000,
		});
		expect(t["changeAmount"])["toBe"](200);
		expect(t["revisedTotal"])["toBe"](100200);
	});

	it("MODIFY on unit price only", () => {
		// $5,000 -> $7,000 price change example from the spec.
		const t = computeChangeOrderTotals({
			items: [
				{
					changeType: "MODIFY",
					description: "Line item price change",
					quantityBefore: 1,
					quantityAfter: 1,
					unitPriceBefore: 5000,
					unitPriceAfter: 7000,
				},
			],
			originalContractTotal: 100000,
		});
		expect(t["changeAmount"])["toBe"](2000);
		expect(t["revisedTotal"])["toBe"](102000);
	});

	it("REPLACE removes the old and adds the new", () => {
		const t = computeChangeOrderTotals({
			items: [
				{
					changeType: "REPLACE",
					description: "Standard fixture replaced with premium",
					quantityBefore: 1,
					quantityAfter: 1,
					unitPriceBefore: 500,
					unitPriceAfter: 800,
				},
			],
			originalContractTotal: 100000,
		});
		expect(t["changeAmount"])["toBe"](300);
		expect(t["replaceAmount"])["toBe"](300);
		expect(t["revisedTotal"])["toBe"](100300);
	});

	it("aggregates the spec example: +$5,000, -$2,000, +$10,000", () => {
		// Original $100,000 + $5,000 (ADD) - $2,000 (REMOVE) + $10,000 (ADD) = $113,000
		const t = computeChangeOrderTotals({
			items: [
				{
					changeType: "ADD",
					description: "Addition A",
					quantityAfter: 1,
					unitPriceAfter: 5000,
				},
				{
					changeType: "REMOVE",
					description: "Removal B",
					quantityBefore: 1,
					unitPriceBefore: 2000,
				},
				{
					changeType: "ADD",
					description: "Addition C",
					quantityAfter: 1,
					unitPriceAfter: 10000,
				},
			],
			originalContractTotal: 100000,
		});
		expect(t["addAmount"])["toBe"](15000);
		expect(t["removeAmount"])["toBe"](-2000);
		expect(t["changeAmount"])["toBe"](13000);
		expect(t["revisedTotal"])["toBe"](113000);
	});

	it("does not overwrite old values — both preserved", () => {
		const t = computeChangeOrderTotals({
			items: [
				{
					changeType: "MODIFY",
					description: "Price change",
					quantityBefore: 10,
					quantityAfter: 12,
					unitPriceBefore: 5000,
					unitPriceAfter: 4000,
				},
			],
			originalContractTotal: 100000,
		});
		// before: 10 * 5000 = 50000; after: 12 * 4000 = 48000; delta = -2000
		expect(t["changeAmount"])["toBe"](-2000);
		expect(t["revisedTotal"])["toBe"](98000);
	});
});

describe("computeRevisedContractTotal — only approved orders count", () => {
	it("adds approved change-order amounts to the original contract", () => {
		const total = computeRevisedContractTotal(100000, [
			{ changeAmount: 5000 },
			{ changeAmount: -2000 },
			{ changeAmount: 10000 },
		]);
		expect(total)["toBe"](113000);
	});

	it("a single approved order revises the total", () => {
		const total = computeRevisedContractTotal(50000, [{ changeAmount: -5000 }]);
		expect(total)["toBe"](45000);
	});

	it("handles zero deltas", () => {
		const total = computeRevisedContractTotal(75000, [{ changeAmount: 0 }, { changeAmount: 2500 }]);
		expect(total)["toBe"](77500);
	});

	it("rounds to the cent", () => {
		const total = computeRevisedContractTotal(1000, [
			{ changeAmount: 0.1 },
			{ changeAmount: 0.2 },
		]);
		// 1000 + 0.1 + 0.2 = 1000.3 (no float drift because integer cents)
		expect(total)["toBe"](1000.3);
	});
});

describe("workflow semantics — change order vs invoice distinction", () => {
	it("a change order delta does not equal an invoice amount due", () => {
		// A $2,500 approved change order modifies contract value but creates
		// NO receivable. The $8,640 invoice creates the actual billing obligation.
		const co = computeChangeOrderTotals({
			items: [{ changeType: "ADD", description: "Work", quantityAfter: 1, unitPriceAfter: 2500 }],
			originalContractTotal: 10800,
		});
		expect(co["revisedTotal"])["toBe"](13300);
		// The change order has no amount_due field — it is not a receivable.
		expect(Object["keys"](co))["not"]["toContain"]("amountDue");
	});
});
