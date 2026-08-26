import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD") {
  return new Intl["NumberFormat"]("en-US", {
    style: "currency",
    currency,
  })["format"](amount || 0);
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d["toLocaleDateString"]("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
