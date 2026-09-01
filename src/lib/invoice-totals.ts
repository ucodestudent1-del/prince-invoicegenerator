/**
 * Pure invoice total math (Plan B2).
 *
 * Centralised so the same rounding rules apply to `createInvoice`,
 * `updateInvoice`, and the recurring-invoice generator. Every monetary
 * value is rounded to two decimal places before it leaves this module.
 */

export type InvoiceTotals = {
  subtotal: number;
  taxAmount: number;
  discount: number;
  retainageAmount: number;
  totalBeforeRetainage: number;
  total: number;
};

const cents = (n: number) => Math["round"](n * 100) / 100;

export function computeInvoiceTotals(input: {
  items: Array<{ quantity: number; unitPrice: number }>;
  taxRate: number;
  discount: number;
  retainageRate: number;
}): InvoiceTotals {
  const subtotal = cents(
    input["items"]["reduce"]((acc, it) => acc + it["quantity"] * it["unitPrice"], 0)
  );
  const taxAmount = cents((subtotal * input["taxRate"]) / 100);
  // Clamp the pre-retainage total at zero so a discount that exceeds the
  // subtotal+tax cannot produce a negative invoice.
  const totalBeforeRetainage = cents(
    Math["max"](0, subtotal + taxAmount - input["discount"])
  );
  const retainageAmount = cents((totalBeforeRetainage * input["retainageRate"]) / 100);
  const total = cents(totalBeforeRetainage - retainageAmount);

  return {
    subtotal,
    taxAmount,
    discount: cents(input["discount"]),
    retainageAmount,
    totalBeforeRetainage,
    total,
  };
}
