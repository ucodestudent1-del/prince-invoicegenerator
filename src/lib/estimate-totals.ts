/**
 * Estimate total calculations.
 *
 * An Estimate is a *proposal*. Its `total` is a proposed amount that does NOT
 * represent money currently owed by the customer. Accepting an estimate must
 * not automatically create an accounts-receivable balance.
 *
 * Key semantic rules encoded here:
 *  - An estimate total is: subtotal - discounts + taxes + fees.
 *  - **Optional** line items (products/services the customer may or may not
 *    select) are tracked separately and do NOT increase the primary estimate
 *    total unless the customer explicitly selects them. `optionalTotal` is
 *    reported alongside the required total so the UI can show "base" vs
 *    "with selected options".
 *  - A `discount_type` / `discount_value` on a line drives a per-line discount;
 *    a document-level discount is expressed via `discount_type`/`discount_value`
 *    at the top level.
 *  - `expiration_date` is a proposal-validity date, NOT a payment due date.
 *    It is intentionally absent from this calculation module.
 */

import {
	computeDocumentTotals,
	computeLineDiscount,
	computeLineFee,
	computeLineTax,
	sumMoney,
	addMoney,
	subtractMoney,
	roundMoney,
} from "@/lib/money";
import type { DiscountType } from "@/lib/money";

export interface EstimateLineItemInput {
	quantity: number;
	unitPrice: number;
	discountType?: DiscountType;
	discountValue?: number;
	taxable?: boolean;
	taxRate?: number;
	feeRate?: number;
	isOptional?: boolean;
}

export interface EstimateTotalsInput {
	items: EstimateLineItemInput[];
	discountType?: DiscountType;
	discountValue?: number;
	taxRate?: number;
	feeRate?: number;
}

export interface EstimateTotals {
	subtotal: number;
	discountTotal: number;
	taxTotal: number;
	feeTotal: number;
	total: number;
	/** Total of required (non-optional) line items only, before tax/fees/discount. */
	requiredSubtotal: number;
	/** Total of optional line items only, before tax/fees/discount. */
	optionalSubtotal: number;
	/**
	 * Proposed total including selected optional items.
	 * Required total + sum of optional items (discounts/tax/fees applied across
	 * the combined set).
	 */
	totalWithOptionals: number;
}

function lineSubtotal(it: { quantity: number; unitPrice: number }): number {
	return roundMoney(it["quantity"] * it["unitPrice"]);
}

/**
 * Sum the *raw* subtotal (quantity * unitPrice) for a subset of items.
 */
function subtotalOf(items: EstimateLineItemInput[]): number {
	return sumMoney(items["map"](lineSubtotal));
}

/**
 * Compute the full estimate breakdown. Required (non-optional) items drive the
 * primary `total`; optional items are rolled up into `optionalSubtotal` and
 * included only in `totalWithOptionals`.
 */
export function computeEstimateTotals(input: EstimateTotalsInput): EstimateTotals {
	const requiredItems = input["items"]["filter"]((it) => !it["isOptional"]);
	const optionalItems = input["items"]["filter"]((it) => it["isOptional"]);

	const requiredSubtotal = subtotalOf(requiredItems);
	const optionalSubtotal = subtotalOf(optionalItems);

	// Build a combined view for totalWithOptionals, then a "required only"
	// view for the primary total.
	const requiredBreakdown = computeDocumentTotals({
		items: requiredItems,
		globalDiscountType: input["discountType"],
		globalDiscountValue: input["discountValue"],
		taxRate: input["taxRate"],
		feeRate: input["feeRate"],
	});

	const combinedBreakdown = computeDocumentTotals({
		items: input["items"],
		globalDiscountType: input["discountType"],
		globalDiscountValue: input["discountValue"],
		taxRate: input["taxRate"],
		feeRate: input["feeRate"],
	});

	return {
		subtotal: requiredBreakdown["subtotal"],
		discountTotal: requiredBreakdown["discountTotal"],
		taxTotal: requiredBreakdown["taxTotal"],
		feeTotal: requiredBreakdown["feeTotal"],
		total: requiredBreakdown["total"],
		requiredSubtotal,
		optionalSubtotal,
		totalWithOptionals: combinedBreakdown["total"],
	};
}

/**
 * Per-line estimate detail. This is the shape each line item should be persisted
 * in, so that "what changed" on a line is always reconstructible.
 */
export interface EstimateLineItemDetail {
	id?: string;
	estimateId?: string | null;
	position: number;
	itemId?: string | null;
	description: string;
	quantity: number;
	unit: string;
	unitPrice: number;
	discountType: DiscountType;
	discountValue: number;
	taxable: boolean;
	taxRate: number;
	lineSubtotal: number;
	lineDiscount: number;
	lineTax: number;
	lineTotal: number;
	isOptional: boolean;
}

/**
 * Compute the persisted detail for a single estimate line item.
 */
export function computeEstimateLineItemDetail(
 	input: EstimateLineItemInput & { description: string; unit: string; position: number; itemId?: string | null; id?: string; estimateId?: string }
): EstimateLineItemDetail {
	const lineSubtotal = roundMoney(input["quantity"] * input["unitPrice"]);
	const lineDiscount = computeLineDiscount(
		input["quantity"],
		input["unitPrice"],
		input["discountType"],
		input["discountValue"]
	);
	const lineTax = computeLineTax(lineSubtotal, lineDiscount, input["taxRate"], input["taxable"]);
	const lineFee = computeLineFee(lineSubtotal, input["feeRate"]);
	const lineTotal = addMoney(addMoney(subtractMoney(lineSubtotal, lineDiscount), lineTax), lineFee);

	return {
		id: input["id"],
		estimateId: input["estimateId"] ?? null,
		position: input["position"],
		itemId: input["itemId"] ?? null,
		description: input["description"],
		quantity: roundMoney(input["quantity"]),
		unit: input["unit"],
		unitPrice: roundMoney(input["unitPrice"]),
		discountType: input["discountType"] ?? "PERCENT",
		discountValue: input["discountValue"] ?? 0,
		taxable: input["taxable"] ?? false,
		taxRate: input["taxRate"] ?? 0,
		lineSubtotal,
		lineDiscount,
		lineTax,
		lineTotal,
		isOptional: input["isOptional"] ?? false,
	};
}

/**
 * Re-aggregate persisted line-item details back into document totals. Useful
 * for recalculating an estimate total from stored line rows.
 */
export function computeEstimateTotalsFromLines(lines: EstimateLineItemDetail[]): EstimateTotals {
	const input: EstimateTotalsInput = {
		items: lines["map"]((l) => ({
			quantity: l["quantity"],
			unitPrice: l["unitPrice"],
			discountType: l["discountType"],
			discountValue: l["discountValue"],
			taxable: l["taxable"],
			taxRate: l["taxRate"],
			feeRate: 0,
			isOptional: l["isOptional"],
		})),
	};
	return computeEstimateTotals(input);
}
