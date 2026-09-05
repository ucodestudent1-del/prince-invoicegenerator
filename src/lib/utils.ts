import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type FormatterLocale = string;

const DEFAULT_FORMATTER_LOCALE: FormatterLocale = "en-US";

/**
 * Build a stable BCP-47 tag for `Intl.NumberFormat` / `Intl.DateTimeFormat`.
 * Accepts the org's `numberFormat` (a BCP-47 tag like "en-US" or "fr-FR") and
 * falls back to "en-US" if the value is missing or unrecognised.
 */
export function resolveFormatterLocale(value: string | null | undefined): FormatterLocale {
  if (!value) return DEFAULT_FORMATTER_LOCALE;
  // Intl.DateTimeFormat ctor accepts any string and resolves it; if it can't,
  // it throws RangeError. Try once and fall back rather than crash callers.
  try {
    new Intl.NumberFormat(value).format(0);
    return value;
  } catch {
    return DEFAULT_FORMATTER_LOCALE;
  }
}

function currencyFormatter(locale: FormatterLocale, currency: string): Intl.NumberFormat {
	try {
		return new Intl.NumberFormat(locale, { style: "currency", currency });
	} catch {
		// Unknown currency code — fall back to USD with the requested locale so
		// the user still gets a properly-grouped, properly-decimaled number.
		return new Intl.NumberFormat(locale, { style: "currency", currency: "USD" });
	}
}

function dateFormatter(locale: FormatterLocale): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat(locale, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

/**
 * Format a money amount using the org's preferred locale and the currency
 * stored on the row (or the org's default currency if not provided).
 *
 * The `locale` argument must be a BCP-47 tag. The default is "en-US" so
 * existing callers in tests and non-i18n code paths keep working.
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: FormatterLocale = DEFAULT_FORMATTER_LOCALE
): string {
  if (!Number["isFinite"](amount)) amount = 0;
  return currencyFormatter(locale, currency)["format"](amount);
}

/**
 * Format a date using the org's preferred locale. Returns the em-dash
 * placeholder used elsewhere in the UI when the input is nullish.
 */
export function formatDate(
  date: Date | string | null | undefined,
  locale: FormatterLocale = DEFAULT_FORMATTER_LOCALE
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number["isNaN"](d["getTime"]())) return "—";
  return dateFormatter(locale)["format"](d);
}

export function quoteFontFamily(font: string) {
  return font["includes"](" ") ? `"${font}"` : font;
}

export function coerceEnum<E extends string>(
  value: unknown,
  enumObj: Record<string, E>,
  field: string
): E {
  const values = (Object["values"](enumObj) as E[])["filter"]((v) => typeof v === "string");
  if (value !== undefined && value !== null && values["includes"](value as E)) {
    return value as E;
  }
  throw new Error(
    `Invalid value for "${field}": expected one of [${values["join"](", ")}], received ${JSON.stringify(value)}`
  );
}
