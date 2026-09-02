import { describe, expect, it } from "vitest";
import {
	addMoney,
	computeDocumentTotals,
	computeLineDiscount,
	computeLineFee,
	computeLineTax,
	fromCents,
	roundMoney,
	subtractMoney,
	sumMoney,
	sumPayments,
	toCents,
} from "@/lib/money";

describe("toCents / fromCents", () => {
	it("converts dollars to cents with half-up rounding", () => {
		// 0.125 is exactly representable; 0.125 * 100 = 12.5 -> rounds up to 13
		expect(toCents(0.125))["toBe"](13);
		expect(toCents(0.1))["toBe"](10);
		expect(toCents(2))["toBe"](200);
	});

	it("converts cents back to dollars", () => {
		expect(fromCents(100))["toBe"](1);
		expect(fromCents(101))["toBe"](1.01);
	});

	it("round-trip is lossless for 2-decimal values", () => {
		for (const v of [0, 0.01, 19.99, 100, 1234.56, -5.25]) {
			expect(fromCents(toCents(v)))["toBe"](roundMoney(v));
		}
	});

	it("handles non-finite input as zero", () => {
		expect(toCents(NaN))["toBe"](0);
		expect(toCents(Infinity))["toBe"](0);
		expect(fromCents(NaN))["toBe"](0);
	});
});

describe("roundMoney", () => {
	it("rounds half-up on exactly-representable values", () => {
		expect(roundMoney(0.125))["toBe"](0.13);
		expect(roundMoney(2.5))["toBe"](2.5);
	});

	it("eliminates 0.1 + 0.2 float drift", () => {
		expect(roundMoney(0.1 + 0.2))["toBe"](0.3);
	});
});

describe("addMoney / subtractMoney", () => {
	it("adds without float drift", () => {
		expect(addMoney(0.1, 0.2))["toBe"](0.3);
		expect(addMoney(19.99, 0.01))["toBe"](20);
	});

	it("subtracts without float drift", () => {
		expect(subtractMoney(100, 99.99))["toBe"](0.01);
		expect(subtractMoney(0.3, 0.1))["toBe"](0.2);
	});
});

describe("sumMoney", () => {
	it("sums an array of dollar amounts precisely", () => {
		expect(sumMoney([0.1, 0.2, 0.3]))["toBe"](0.6);
		expect(sumMoney([19.99, 0.01, 5.0]))["toBe"](25);
	});

	it("returns 0 for an empty array", () => {
		expect(sumMoney([]))["toBe"](0);
	});
});

describe("computeLineDiscount", () => {
	it("percent discount on the line subtotal", () => {
		// 10 * 50 = 500 subtotal; 10% = 50
		expect(computeLineDiscount(10, 50, "PERCENT", 10))["toBe"](50);
	});

	it("fixed discount caps at the line subtotal", () => {
		// 1 * 10 = 10 subtotal; fixed 999 should clamp to 10
		expect(computeLineDiscount(1, 10, "FIXED", 999))["toBe"](10);
	});

	it("returns 0 when no discount type", () => {
		expect(computeLineDiscount(5, 20, undefined, undefined))["toBe"](0);
	});

	it("returns 0 for free line", () => {
		expect(computeLineDiscount(5, 0, "PERCENT", 20))["toBe"](0);
	});
});

describe("computeLineTax", () => {
	it("computes tax on the taxable base after discount", () => {
		// base = 100 - 10 = 90; 8.875% = 7.9875 -> 7.99
		expect(computeLineTax(100, 10, 8.875, true))["toBe"](7.99);
	});

	it("returns 0 for non-taxable lines", () => {
		expect(computeLineTax(100, 0, 8.875, false))["toBe"](0);
	});

	it("returns 0 when base is negative after discount", () => {
		expect(computeLineTax(10, 20, 8.875, true))["toBe"](0);
	});

	it("returns 0 when no tax rate", () => {
		expect(computeLineTax(100, 0, undefined, true))["toBe"](0);
	});
});

describe("computeLineFee", () => {
	it("computes a percentage fee on the line subtotal", () => {
		// 10% of 200 = 20
		expect(computeLineFee(200, 10))["toBe"](20);
	});

	it("returns 0 when no fee rate", () => {
		expect(computeLineFee(200, undefined))["toBe"](0);
	});
});

describe("computeDocumentTotals", () => {
	it("simple subtotal with no tax/discount/fee", () => {
		const t = computeDocumentTotals({
			items: [{ quantity: 2, unitPrice: 50, taxable: false }],
			taxRate: 0,
			discount: 0,
			globalDiscount: 0,
		});
		expect(t["subtotal"])["toBe"](100);
		expect(t["discountTotal"])["toBe"](0);
		expect(t["taxTotal"])["toBe"](0);
		expect(t["feeTotal"])["toBe"](0);
		expect(t["total"])["toBe"](100);
	});

	it("applies percent tax", () => {
		const t = computeDocumentTotals({
			items: [{ quantity: 1, unitPrice: 100, taxable: true }],
			taxRate: 8.875,
		});
		expect(t["subtotal"])["toBe"](100);
		expect(t["taxTotal"])["toBe"](8.88);
		expect(t["total"])["toBe"](108.88);
	});

	it("applies line-level discounts before tax", () => {
		const t = computeDocumentTotals({
			items: [
				{ quantity: 1, unitPrice: 100, discountType: "PERCENT", discountValue: 10, taxable: true, taxRate: 10 },
			],
			taxRate: 10,
		});
		expect(t["subtotal"])["toBe"](100);
		expect(t["discountTotal"])["toBe"](10);
		// tax on (100 - 10) = 90 * 10% = 9
		expect(t["taxTotal"])["toBe"](9);
		expect(t["total"])["toBe"](99);
	});

	it("applies a global percent discount", () => {
		const t = computeDocumentTotals({
			items: [{ quantity: 2, unitPrice: 50, taxable: true }],
			globalDiscountType: "PERCENT",
			globalDiscountValue: 10,
			taxRate: 0,
		});
		// subtotal 100, 10% discount = 10
		expect(t["subtotal"])["toBe"](100);
		expect(t["discountTotal"])["toBe"](10);
		expect(t["total"])["toBe"](90);
	});

	it("applies a fee on the subtotal", () => {
		const t = computeDocumentTotals({
			items: [{ quantity: 1, unitPrice: 200, taxable: true }],
			taxRate: 0,
			feeRate: 5,
		});
		expect(t["feeTotal"])["toBe"](10);
		expect(t["total"])["toBe"](210);
	});

	it("clamps discount so total never goes negative", () => {
		const t = computeDocumentTotals({
			items: [{ quantity: 1, unitPrice: 10 }],
			globalDiscount: 999,
		});
		expect(t["total"])["toBe"](0);
	});

	it("rounds to the cent across many small lines", () => {
		const t = computeDocumentTotals({
			items: [
				{ quantity: 1, unitPrice: 0.1, taxable: false },
				{ quantity: 1, unitPrice: 0.2, taxable: false },
			],
		});
		expect(t["subtotal"])["toBe"](0.3);
		expect(t["total"])["toBe"](0.3);
	});
});

describe("sumPayments", () => {
	it("sums payment amounts precisely", () => {
		expect(sumPayments([{ amount: 100 }, { amount: 0.1 }, { amount: 0.2 }]))["toBe"](100.3);
	});

	it("returns 0 for no payments", () => {
		expect(sumPayments([]))["toBe"](0);
	});
});
