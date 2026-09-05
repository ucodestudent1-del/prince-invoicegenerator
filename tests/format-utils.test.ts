import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, resolveFormatterLocale } from "../src/lib/utils";

describe("formatCurrency — locale-aware", () => {
	it("uses en-US by default", () => {
		// $1,234.56 in US English (comma thousands, period decimal).
		expect(formatCurrency(1234.56)).toBe("$1,234.56");
	});

	it("formats EUR with the user's locale conventions", () => {
		// French (fr-FR) uses thin space thousands and comma decimal.
		const fr = formatCurrency(1234.56, "EUR", "fr-FR");
		expect(fr).toContain("1\u202f234,56");
		expect(fr).toContain("\u20AC");
	});

	it("formats GBP in en-GB", () => {
		const gb = formatCurrency(1234.56, "GBP", "en-GB");
		expect(gb).toBe("\u00A3" + "1,234.56");
	});

	it("coerces non-finite values to 0 rather than rendering NaN", () => {
		expect(formatCurrency(Number.NaN, "USD", "en-US")).toBe("$0.00");
		expect(formatCurrency(Number.POSITIVE_INFINITY, "USD", "en-US")).toBe("$0.00");
	});

	it("falls back to USD formatting when an unknown currency code is supplied", () => {
		// BOGUS is not an ISO 4217 code; Intl throws on a strict implementation,
		// so the helper must swallow and render in USD with the requested locale.
		const out = formatCurrency(50, "BOGUS", "en-US");
		expect(out).toBe("$50.00");
	});
});

describe("formatDate — locale-aware", () => {
	it("returns the em-dash placeholder for nullish input", () => {
		expect(formatDate(null)).toBe("\u2014");
		expect(formatDate(undefined)).toBe("\u2014");
	});

	it("returns the em-dash placeholder for invalid dates", () => {
		expect(formatDate("not a date")).toBe("\u2014");
	});

	it("uses the user locale for en-US", () => {
		const out = formatDate(new Date(2024, 0, 5), "en-US");
		// Exact form depends on the runtime ICU build, but the month abbreviation
		// and year must be present.
		expect(out).toContain("Jan");
		expect(out).toContain("2024");
	});
});

describe("resolveFormatterLocale", () => {
	it("accepts well-formed BCP-47 tags", () => {
		expect(resolveFormatterLocale("en-US")).toBe("en-US");
		expect(resolveFormatterLocale("fr-FR")).toBe("fr-FR");
	});

	it("falls back to en-US for unknown values", () => {
		expect(resolveFormatterLocale(null)).toBe("en-US");
		expect(resolveFormatterLocale(undefined)).toBe("en-US");
		expect(resolveFormatterLocale("not a locale")).toBe("en-US");
	});
});
