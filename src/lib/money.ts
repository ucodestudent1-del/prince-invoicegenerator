/**
 * Fixed-point money arithmetic.
 *
 * All monetary math in the invoice/estimate/change-order domain is performed
 * in integer *cents* and only converted back to a dollar `number` at the
 * boundary. Binary floating point cannot represent 0.1 + 0.2 exactly, so the
 * previous float-based helpers drifted by a sub-cent on retainage + tax +
 * discount calculations. Integer cents eliminate that class of rounding errors.
 *
 * Convention: public helpers accept and return `number` values in *dollars*
 * (the unit the rest of the codebase stores in Prisma `Float` columns). The
 * internal representation is always cents, rounded half-up via `Math.round` on
 * the scaled value.
 */

/** Convert a dollar amount to integer cents, rounding half-up. */
export function toCents(dollars: number): number {
	if (!Number["isFinite"](dollars)) return 0;
	return Math["round"](dollars * 100);
}

/** Convert integer cents back to a dollar amount (always a finite 2-decimal number). */
export function fromCents(cents: number): number {
	if (!Number["isFinite"](cents)) return 0;
	return Math["round"](cents) / 100;
}

/** Round a dollar amount to two decimal places (half-up). */
export function roundMoney(dollars: number): number {
	return fromCents(toCents(dollars));
}

export type DiscountType = "PERCENT" | "FIXED";

export interface LineInput {
	quantity: number;
	unitPrice: number;
	discountType?: DiscountType;
	discountValue?: number;
	taxRate?: number;
	feeRate?: number;
	taxable?: boolean;
}

export interface MoneyBreakdown {
	subtotal: number;
	discountTotal: number;
	taxTotal: number;
	feeTotal: number;
	total: number;
}

/** Add two dollar amounts precisely. */
export function addMoney(a: number, b: number): number {
	return fromCents(toCents(a) + toCents(b));
}

/** Subtract `b` from `a` precisely. */
export function subtractMoney(a: number, b: number): number {
	return fromCents(toCents(a) - toCents(b));
}

/**
 * Sum a list of dollar amounts precisely. Returns 0 for an empty list.
 * Intermediate accumulation happens in cents to avoid drift.
 */
export function sumMoney(values: number[]): number {
	let cents = 0;
	for (const v of values) {
		cents += toCents(v);
	}
	return fromCents(cents);
}

/**
 * Compute the effective discount for a line given its discount type/value.
 * `PERCENT` discounts are applied to quantity * unitPrice; `FIXED` discounts
 * are a flat amount taken off the line subtotal.
 */
export function computeLineDiscount(
	quantity: number,
	unitPrice: number,
	discountType: DiscountType | undefined,
	discountValue: number | undefined
): number {
	if (!discountType || !discountValue) return 0;
	// Compute the line subtotal in dollars first, then convert to cents once.
	// (toCents(qty) * toCents(price) would multiply cents by cents = cents².)
	const subtotalCents = toCents(quantity * unitPrice);
	if (subtotalCents === 0) return 0;
	if (discountType === "PERCENT") {
		return fromCents(Math["round"]((subtotalCents * discountValue) / 100));
	}
	// FIXED: cap at the line subtotal so a discount cannot make a line negative.
	const fixedCents = toCents(discountValue);
	return fromCents(Math["max"](0, Math["min"](fixedCents, subtotalCents)));
}

/**
 * Compute the tax for a line: tax_rate% of the taxable base
 * (line_subtotal - line_discount). Taxes are only applied when `taxable` is true.
 */
export function computeLineTax(
	lineSubtotal: number,
	lineDiscount: number,
	taxRate: number | undefined,
	taxable: boolean | undefined
): number {
	if (!taxable) return 0;
	const baseCents = toCents(lineSubtotal) - toCents(lineDiscount);
	if (baseCents <= 0) return 0;
	return fromCents(Math["round"]((baseCents * (taxRate ?? 0)) / 100));
}

/**
 * Compute a fee for a line from a percentage fee rate applied to the line
 * subtotal (pre-discount, pre-tax).
 */
export function computeLineFee(lineSubtotal: number, feeRate: number | undefined): number {
	if (!feeRate) return 0;
	return fromCents(Math["round"]((toCents(lineSubtotal) * feeRate) / 100));
}

/**
 * Generic "sum items, apply a percent or fixed discount, then tax the result."
 *
 * This is the shared kernel used by invoice, estimate, and change-order
 * calculations. Each document type owns its own breakdown type so the field
 * names stay distinct (estimate_total vs change_amount vs invoice_total).
 */
export function computeDocumentTotals(input: {
	items: LineInput[];
	globalDiscountType?: DiscountType;
	globalDiscountValue?: number;
	globalDiscount?: number;
	feeRate?: number;
	taxRate?: number;
}): MoneyBreakdown {
	const lines = input["items"];

	let subtotalCents = 0;
	let lineDiscountCents = 0;
	for (const it of lines) {
		const lineCents = toCents(it["quantity"] * it["unitPrice"]);
		subtotalCents += lineCents;
		lineDiscountCents += toCents(
			computeLineDiscount(it["quantity"], it["unitPrice"], it["discountType"], it["discountValue"])
		);
	}
	const subtotal = fromCents(subtotalCents);
	const lineDiscountTotal = fromCents(lineDiscountCents);

	let globalDiscountCents = 0;
	if (input["globalDiscountType"] && input["globalDiscountValue"] != null) {
		if (input["globalDiscountType"] === "PERCENT") {
			globalDiscountCents = Math["round"]((subtotalCents * input["globalDiscountValue"]) / 100);
		} else {
			globalDiscountCents = Math["min"](toCents(input["globalDiscountValue"]), subtotalCents);
		}
	} else if (input["globalDiscount"] != null) {
		globalDiscountCents = Math["min"](toCents(input["globalDiscount"]), subtotalCents);
	}
	const discountTotal = fromCents(lineDiscountCents + globalDiscountCents);

	const feeTotal = input["feeRate"]
		? fromCents(Math["round"]((subtotalCents * input["feeRate"]) / 100))
		: 0;

	const discountTotalCents = lineDiscountCents + globalDiscountCents;
	const taxBaseCents = subtotalCents - discountTotalCents;
	const taxTotal = taxBaseCents > 0 && input["taxRate"]
		? fromCents(Math["round"]((taxBaseCents * (input["taxRate"] ?? 0)) / 100))
		: 0;

	const total = fromCents(
		subtotalCents - discountTotalCents + toCents(taxTotal) + toCents(feeTotal)
	);

	return {
		subtotal,
		discountTotal,
		taxTotal,
		feeTotal,
		total,
	};
}

/**
 * Sum an array of payment amounts precisely (in cents).
 */
export function sumPayments(payments: Array<{ amount: number }>): number {
	return sumMoney(payments["map"]((p) => p["amount"]));
}
