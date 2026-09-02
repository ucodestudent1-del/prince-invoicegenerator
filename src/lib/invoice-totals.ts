/**
 * Pure invoice total math.
 *
 * Centralised so the same rounding rules apply to `createInvoice`,
 * `updateInvoice`, and the recurring-invoice generator. Every monetary
 * value is rounded to two decimal places (integer cents) before it leaves
 * this module, eliminating the floating-point drift that previously caused
 * retainage + tax + discount calculations to refuse to balance.
 *
 * Invoice semantics (vs. Estimate / Change Order):
 *  - `total` = subtotal - discounts + taxes + fees. This is the AMOUNT BILLED.
 *  - `amount_due` = total - payments - credits. This is what the customer
 *    currently owes and participates in accounts receivable / aging.
 *  - Unlike an Estimate's `total` (a proposal), an Invoice `total` is a billing
 *    obligation. Unlike a Change Order's `change_amount` (a delta), an Invoice
 *    `total` is an absolute billed amount.
 */

import {
	toCents,
	fromCents,
	roundMoney,
	addMoney,
	subtractMoney,
	sumMoney,
} from "@/lib/money";

export type InvoiceTotals = {
	subtotal: number;
	taxAmount: number;
	discount: number;
	feeTotal: number;
	retainageAmount: number;
	totalBeforeRetainage: number;
	total: number;
};

/**
 * Compute the invoice line+header totals.
 *
 * `feeRate` is a percentage applied to the subtotal (e.g. a processing fee).
 * The discount is a fixed dollar amount (document-level) and is clamped so a
 * discount that exceeds subtotal+tax cannot produce a negative invoice.
 */
export function computeInvoiceTotals(input: {
	items: Array<{ quantity: number; unitPrice: number }>;
	taxRate: number;
	discount: number;
	retainageRate: number;
	feeRate?: number;
}): InvoiceTotals {
	const subtotal = roundMoney(
		input["items"]["reduce"]((acc, it) => acc + it["quantity"] * it["unitPrice"], 0)
	);
	const taxAmount = roundMoney((subtotal * input["taxRate"]) / 100);
	const totalBeforeRetainage = roundMoney(
		Math["max"](0, subtotal + taxAmount - input["discount"])
	);
	const retainageAmount = roundMoney((totalBeforeRetainage * input["retainageRate"]) / 100);
	const feeTotal = input["feeRate"]
		? roundMoney((subtotal * input["feeRate"]) / 100)
		: 0;
	// Fees are added before retainage so they are subject to the retainage hold.
	const totalBeforeRetainageWithFee = roundMoney(totalBeforeRetainage + feeTotal);
	const retainageOnFee = roundMoney((feeTotal * input["retainageRate"]) / 100);
	const total = roundMoney(
		totalBeforeRetainageWithFee - retainageAmount - retainageOnFee
	);

	return {
		subtotal,
		taxAmount,
		discount: roundMoney(input["discount"]),
		feeTotal,
		retainageAmount,
		totalBeforeRetainage: totalBeforeRetainageWithFee,
		total,
	};
}

/**
 * Compute the amount a customer currently owes.
 *
 * amount_due = total - payments - credits
 *
 * Only invoices participate in this calculation. The result is clamped at zero
 * (a customer cannot have a negative balance from over-payment through this
 * path — overpayments create a credit instead).
 */
export function computeAmountDue(
	invoiceTotal: number,
	paymentsTotal: number,
	creditsTotal: number
): number {
	const total = toCents(invoiceTotal);
	const paid = toCents(paymentsTotal);
	const credited = toCents(creditsTotal);
	const due = Math["max"](0, total - paid - credited);
	return fromCents(due);
}

/**
 * Determine the invoice status based on the amount paid vs. total.
 *
 *  - total == 0 (and not voided) → UNPAID (no balance but no payment either)
 *  - amount_due == 0  → PAID
 *  - amount_paid == 0 → UNPAID (or SENT depending on whether it's been issued)
 *  - otherwise         → PARTIALLY_PAID
 *
 * The caller is responsible for OVERDUE / VOID / CANCELLED transitions, which
 * depend on dates and actions outside the payment math.
 */
export function deriveInvoicePaymentStatus(
	total: number,
	amountPaid: number,
	creditsTotal: number,
	hasBeenSent: boolean
): "PAID" | "PARTIALLY_PAID" | "UNPAID" | "DRAFT" {
	const due = computeAmountDue(total, amountPaid, creditsTotal);
	if (due <= 0.01 && total > 0) {
		return "PAID";
	}
	if (amountPaid <= 0 && creditsTotal <= 0) {
		return hasBeenSent ? "UNPAID" : "DRAFT";
	}
	return "PARTIALLY_PAID";
}

/**
 * Sum an array of payment amounts precisely (in cents).
 */
export function sumPayments(payments: Array<{ amount: number }>): number {
	return sumMoney(payments["map"]((p) => p["amount"]));
}
