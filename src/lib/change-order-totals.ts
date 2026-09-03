/**
 * Change Order total calculations.
 *
 * A Change Order represents a modification to an *existing agreed or contracted*
 * scope of work. It answers "What are we changing?" — not "What does the
 * customer owe right now?" An approved Change Order modifies the effective
 * contract value, but it does NOT create an accounts-receivable balance, payment
 * due, or invoice unless a separate invoicing operation occurs.
 *
 * Key semantic rules encoded here:
 *  - `change_amount` is the NET financial delta (additions - removals + price
 *    adjustments). It can be positive, negative, or zero.
 *  - Each line preserves `quantity_before` / `quantity_after` / `quantity_delta`
 *    (and the original vs revised unit prices) so that "what changed" is always
 *    reconstructible. Old values are never silently overwritten.
 *  - `revised_total` = previous effective contract total + approved change amount.
 *  - Draft / pending / rejected / cancelled change orders do NOT affect the
 *    effective contract value — only APPROVED ones do (enforced by the workflow
 *    module, but the calculation helpers assume the caller has already filtered
 *    to approved orders).
 */

import {
	computeLineDiscount,
	toCents,
	fromCents,
	roundMoney,
} from "@/lib/money";
import type { DiscountType } from "@/lib/money";

export type ChangeType = "ADD" | "REMOVE" | "MODIFY" | "REPLACE";

export interface ChangeOrderLineItemInput {
	changeType: ChangeType;
	itemId?: string | null;
	description: string;
	quantityBefore?: number | null;
	quantityAfter?: number | null;
	unit?: string;
	unitPriceBefore?: number | null;
	unitPriceAfter?: number | null;
	taxable?: boolean;
	taxRate?: number;
	discountType?: DiscountType;
	discountValue?: number;
}

export interface ChangeOrderTotalsInput {
	items: ChangeOrderLineItemInput[];
	/** The contract total that these changes apply to. */
	originalContractTotal: number;
}

export interface ChangeOrderTotals {
	/** Sum of all line deltas, expressed in dollars. */
	changeAmount: number;
	/** originalContractTotal + changeAmount (only meaningful when approved). */
	revisedTotal: number;
	/** Break down the delta by change type. */
	addAmount: number;
	removeAmount: number;
	modifyAmount: number;
	replaceAmount: number;
	subtotal: number;
	discountTotal: number;
	taxTotal: number;
}

/**
 * The line-level dollar delta for a single change-order line.
 *
 * - ADD:     new work  → +quantity_after * unit_price_after
 * - REMOVE:  dropped work → -(quantity_before * unit_price_before)
 * - MODIFY:  same work, different quantity/price →
 *            (qty_after * price_after) - (qty_before * price_before)
 * - REPLACE: old item swapped for new →
 *            -(qty_before * price_before) + (qty_after * price_after)
 *
 * Returns the delta in cents so additions and removals can be summed without
 * float drift, then converted back to dollars at the boundary.
 */
function lineDeltaCents(it: ChangeOrderLineItemInput): number {
	const beforeCents = toCents((it["quantityBefore"] ?? 0) * (it["unitPriceBefore"] ?? 0));
	const afterCents = toCents((it["quantityAfter"] ?? 0) * (it["unitPriceAfter"] ?? 0));

	switch (it["changeType"]) {
		case "ADD":
			return afterCents;
		case "REMOVE":
			return -beforeCents;
		case "MODIFY":
			return afterCents - beforeCents;
		case "REPLACE":
			return afterCents - beforeCents;
		default:
			return 0;
	}
}

/**
 * Compute the full change-order breakdown.
 */
export function computeChangeOrderTotals(input: ChangeOrderTotalsInput): ChangeOrderTotals {
	let addCents = 0;
	let removeCents = 0;
	let modifyCents = 0;
	let replaceCents = 0;
	let deltaCents = 0;

	let discountCents = 0;
	let taxCents = 0;
	let subtotalCents = 0;

	for (const it of input["items"]) {
		const delta = lineDeltaCents(it);
		deltaCents += delta;

		// Categorise the delta by change type for reporting.
		switch (it["changeType"]) {
			case "ADD":
				addCents += delta;
				subtotalCents += toCents((it["quantityAfter"] ?? 0) * (it["unitPriceAfter"] ?? 0));
				break;
			case "REMOVE":
				removeCents += delta;
				subtotalCents += -delta; // removals are stored as negative; subtotal is gross
				break;
			case "MODIFY":
				modifyCents += delta;
				subtotalCents += Math["max"](
					toCents((it["quantityBefore"] ?? 0) * (it["unitPriceBefore"] ?? 0)),
					toCents((it["quantityAfter"] ?? 0) * (it["unitPriceAfter"] ?? 0))
				);
				break;
			case "REPLACE":
				replaceCents += delta;
				// REPLACE: the "current" scope value is the after-value.
				subtotalCents += toCents((it["quantityAfter"] ?? 0) * (it["unitPriceAfter"] ?? 0));
				break;
		}

		// Per-line discount (applied to the after-value for ADD/MODIFY/REPLACE,
		// to the before-value for REMOVE).
		const discountBase = it["changeType"] === "REMOVE"
			? roundMoney((it["quantityBefore"] ?? 0) * (it["unitPriceBefore"] ?? 0))
			: roundMoney((it["quantityAfter"] ?? 0) * (it["unitPriceAfter"] ?? 0));
		const lineDiscount = computeLineDiscount(
			it["changeType"] === "REMOVE"
				? (it["quantityBefore"] ?? 0)
				: (it["quantityAfter"] ?? 0),
			it["changeType"] === "REMOVE"
				? (it["unitPriceBefore"] ?? 0)
				: (it["unitPriceAfter"] ?? 0),
			it["discountType"],
			it["discountValue"]
		);
		discountCents += toCents(lineDiscount);

		const taxBaseCents = toCents(discountBase) - toCents(lineDiscount);
		if (it["taxable"] && taxBaseCents > 0) {
			taxCents += Math["round"]((taxBaseCents * (it["taxRate"] ?? 0)) / 100);
		}
	}

	const changeAmount = fromCents(deltaCents);
	// change_amount already includes the per-line tax/discount deltas because the
	// delta is the net of full line totals. The tax/discount breakdowns above
	// are for reporting/audit transparency.
	const revisedTotal = roundMoney(input["originalContractTotal"] + changeAmount);

	return {
		changeAmount,
		revisedTotal,
		addAmount: fromCents(addCents),
		removeAmount: fromCents(removeCents),
		modifyAmount: fromCents(modifyCents),
		replaceAmount: fromCents(replaceCents),
		subtotal: fromCents(subtotalCents),
		discountTotal: fromCents(discountCents),
		taxTotal: fromCents(taxCents),
	};
}

/**
 * Aggregate the approved change orders for a contract/project into the effective
 * contract value.
 *
 * Per the spec: "If the original contract value is $100,000 and approved Change
 * Orders are +$5,000, -$2,000, and +$10,000, the effective contract value
 * should be $113,000."
 *
 * Only APPROVED change orders contribute; drafts, pending, rejected, and
 * cancelled orders are excluded by the caller (the workflow module enforces
 * status before this runs).
 */
export function computeRevisedContractTotal(
	originalContractTotal: number,
	changeOrders: Pick<ChangeOrderTotals, "changeAmount">[]
): number {
	const originalCents = toCents(originalContractTotal);
	let delta = 0;
	for (const co of changeOrders) {
		delta += toCents(co["changeAmount"]);
	}
	return fromCents(originalCents + delta);
}
