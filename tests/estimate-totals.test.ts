import { describe, expect, it } from "vitest";
import { computeEstimateTotals, computeEstimateLineItemDetail } from "@/lib/estimate-totals";
import { roundMoney } from "@/lib/money";

describe("computeEstimateTotals — proposed total", () => {
	it("sums required line items with no tax/discount/fee", () => {
		const t = computeEstimateTotals({
			items: [
				{ quantity: 2, unitPrice: 50, taxable: false },
				{ quantity: 1, unitPrice: 100, taxable: false },
			],
		});
		expect(t["subtotal"])["toBe"](200);
		expect(t["total"])["toBe"](200);
		expect(t["discountTotal"])["toBe"](0);
		expect(t["taxTotal"])["toBe"](0);
		expect(t["feeTotal"])["toBe"](0);
	});

	it("applies tax and discount to required items only", () => {
		const t = computeEstimateTotals({
			items: [{ quantity: 1, unitPrice: 1000, taxable: true }],
			discountType: "PERCENT",
			discountValue: 10,
			taxRate: 8.875,
		});
		// subtotal 1000; 10% discount = 100; taxable base 900; tax = 79.875 -> 79.88
		expect(t["subtotal"])["toBe"](1000);
		expect(t["discountTotal"])["toBe"](100);
		expect(t["taxTotal"])["toBe"](79.88);
		expect(t["total"])["toBe"](979.88);
	});

	it("does NOT include optional items in the primary total", () => {
		const t = computeEstimateTotals({
			items: [
				{ quantity: 1, unitPrice: 100, taxable: false },
				{ quantity: 1, unitPrice: 500, taxable: false, isOptional: true },
			],
		});
		// Primary total reflects only the required $100 line.
		expect(t["total"])["toBe"](100);
		expect(t["requiredSubtotal"])["toBe"](100);
		expect(t["optionalSubtotal"])["toBe"](500);
		// totalWithOptionals rolls in the optional item.
		expect(t["totalWithOptionals"])["toBe"](600);
	});

	it("keeps an all-optional estimate total at zero until selected", () => {
		const t = computeEstimateTotals({
			items: [{ quantity: 3, unitPrice: 25, taxable: false, isOptional: true }],
		});
		expect(t["total"])["toBe"](0);
		expect(t["totalWithOptionals"])["toBe"](75);
	});

	it("applies fees to the required subtotal", () => {
		const t = computeEstimateTotals({
			items: [{ quantity: 1, unitPrice: 1000, taxable: false }],
			feeRate: 2.5,
		});
		expect(t["feeTotal"])["toBe"](25);
		expect(t["total"])["toBe"](1025);
	});

	it("treats total as a proposed amount, never a receivable", () => {
		const t = computeEstimateTotals({
			items: [{ quantity: 1, unitPrice: 10800, taxable: false }],
		});
		// A $10,800 estimate is a proposal. amount_due does not apply.
		expect(t["total"])["toBe"](10800);
		expect(Object["keys"](t))["not"]["toContain"]("amountDue");
	});

	it("rounds to the cent", () => {
		const t = computeEstimateTotals({
			items: [
				{ quantity: 1, unitPrice: 0.1, taxable: false },
				{ quantity: 1, unitPrice: 0.2, taxable: false },
			],
		});
		expect(t["total"])["toBe"](0.3);
	});
});

describe("computeEstimateLineItemDetail", () => {
	it("computes per-line subtotal, discount, tax, total", () => {
		const detail = computeEstimateLineItemDetail({
			description: "Labor",
			unit: "hours",
			position: 0,
			quantity: 10,
			unitPrice: 75,
			discountType: "PERCENT",
			discountValue: 10,
			taxable: true,
			taxRate: 8.875,
		});
		expect(detail["lineSubtotal"])["toBe"](750);
		expect(detail["lineDiscount"])["toBe"](75);
		// tax on (750 - 75) = 675 * 8.875% = 59.90625 -> 59.91
		expect(detail["lineTax"])["toBe"](59.91);
		expect(detail["lineTotal"])["toBe"](roundMoney(750 - 75 + 59.91));
		expect(detail["isOptional"])["toBe"](false);
	});

	it("marks optional lines distinctly", () => {
		const detail = computeEstimateLineItemDetail({
			description: "Premium upgrade",
			unit: "units",
			position: 1,
			quantity: 1,
			unitPrice: 500,
			isOptional: true,
		});
		expect(detail["isOptional"])["toBe"](true);
		expect(detail["lineSubtotal"])["toBe"](500);
		expect(detail["lineTotal"])["toBe"](500);
		expect(detail["lineDiscount"])["toBe"](0);
	});

	it("defaults discount/tax to zero for simple lines", () => {
		const detail = computeEstimateLineItemDetail({
			description: "Materials",
			unit: "units",
			position: 0,
			quantity: 5,
			unitPrice: 20,
		});
		expect(detail["discountType"])["toBe"]("PERCENT");
		expect(detail["discountValue"])["toBe"](0);
		expect(detail["taxable"])["toBe"](false);
		expect(detail["taxRate"])["toBe"](0);
		expect(detail["lineTotal"])["toBe"](100);
	});
});
