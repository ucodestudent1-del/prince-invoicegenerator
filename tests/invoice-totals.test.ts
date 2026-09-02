import { describe, expect, it } from "vitest";
import {
	computeInvoiceTotals,
	computeAmountDue,
	deriveInvoicePaymentStatus,
	sumPayments,
} from "@/lib/invoice-totals";

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

   it("applies a percentage fee on the subtotal", () => {
     const t = computeInvoiceTotals({
       items: [{ quantity: 1, unitPrice: 200 }],
       taxRate: 0,
       discount: 0,
       retainageRate: 0,
       feeRate: 5,
     });
     expect(t["feeTotal"])["toBe"](10);
     expect(t["total"])["toBe"](210);
   });
 });

describe("computeAmountDue — invoice receivable math", () => {
   it("amount_due = total - payments - credits", () => {
     // $8,640 invoice, $5,000 paid, $0 credit → $3,640 due
     expect(computeAmountDue(8640, 5000, 0))["toBe"](3640);
   });

   it("clamps to zero so over-payments do not produce negative balances", () => {
     expect(computeAmountDue(100, 150, 0))["toBe"](0);
     expect(computeAmountDue(100, 50, 60))["toBe"](0);
   });

   it("handles empty payments", () => {
     expect(computeAmountDue(100, 0, 0))["toBe"](100);
   });

   it("is precise with cent-level values", () => {
     // 0.1 + 0.2 float drift must not leak into the balance.
     expect(computeAmountDue(0.3, 0.1 + 0.2, 0))["toBe"](0);
   });
 });

describe("deriveInvoicePaymentStatus — status from payment state", () => {
   it("PARTIALLY_PAID when some but not all is paid", () => {
     expect(deriveInvoicePaymentStatus(8640, 5000, 0, true))["toBe"]("PARTIALLY_PAID");
   });

   it("PAID when amount_due reaches zero", () => {
     expect(deriveInvoicePaymentStatus(8640, 8640, 0, true))["toBe"]("PAID");
   });

   it("PAID when payments + credits cover the total", () => {
     expect(deriveInvoicePaymentStatus(8640, 5000, 3640, true))["toBe"]("PAID");
   });

   it("DRAFT when not sent and nothing paid", () => {
     expect(deriveInvoicePaymentStatus(0, 0, 0, false))["toBe"]("DRAFT");
   });

   it("UNPAID when sent but nothing paid", () => {
     expect(deriveInvoicePaymentStatus(100, 0, 0, true))["toBe"]("UNPAID");
   });
 });

describe("sumPayments", () => {
   it("sums an array of payment amounts precisely", () => {
     expect(sumPayments([{ amount: 100 }, { amount: 0.1 }, { amount: 0.2 }]))["toBe"](100.3);
   });

   it("returns 0 for no payments", () => {
     expect(sumPayments([]))["toBe"](0);
   });
 });
