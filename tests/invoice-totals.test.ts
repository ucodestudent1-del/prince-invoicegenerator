import { describe, expect, it } from "vitest";
import { computeInvoiceTotals } from "@/lib/invoice-totals";

describe("computeInvoiceTotals (B2)", () => {
  it("sums a simple line item with no tax, discount, or retainage", () => {
    const t = computeInvoiceTotals({
      items: [{ quantity: 2, unitPrice: 50 }],
      taxRate: 0,
      discount: 0,
      retainageRate: 0,
    });
    expect(t["subtotal"])["toBe"](100);
    expect(t["total"])["toBe"](100);
  });

  it("applies a percentage tax", () => {
    const t = computeInvoiceTotals({
      items: [{ quantity: 1, unitPrice: 100 }],
      taxRate: 8.875,
      discount: 0,
      retainageRate: 0,
    });
    expect(t["subtotal"])["toBe"](100);
    // 100 * 8.875 / 100 = 8.875
    expect(t["taxAmount"])["toBe"](8.88);
    expect(t["total"])["toBe"](108.88);
  });

  it("applies a discount and clamps the pre-retainage total at zero", () => {
    const overflow = computeInvoiceTotals({
      items: [{ quantity: 1, unitPrice: 10 }],
      taxRate: 0,
      discount: 999,
      retainageRate: 0,
    });
    expect(overflow["subtotal"])["toBe"](10);
    expect(overflow["totalBeforeRetainage"])["toBe"](0);
    expect(overflow["total"])["toBe"](0);
  });

  it("applies retainage on the pre-retainage total", () => {
    const t = computeInvoiceTotals({
      items: [{ quantity: 1, unitPrice: 1000 }],
      taxRate: 10,
      discount: 0,
      retainageRate: 10,
    });
    expect(t["subtotal"])["toBe"](1000);
    expect(t["taxAmount"])["toBe"](100);
    expect(t["totalBeforeRetainage"])["toBe"](1100);
    expect(t["retainageAmount"])["toBe"](110);
    expect(t["total"])["toBe"](990);
  });

  it("rounds all monetary values to 2 decimal places", () => {
    // Subtotal: 0.1 + 0.2 = 0.30000000000000004 in float; we want $0.30.
    const t = computeInvoiceTotals({
      items: [
        { quantity: 1, unitPrice: 0.1 },
        { quantity: 1, unitPrice: 0.2 },
      ],
      taxRate: 0,
      discount: 0,
      retainageRate: 0,
    });
    expect(t["subtotal"])["toBe"](0.3);
    expect(t["total"])["toBe"](0.3);
  });
});
