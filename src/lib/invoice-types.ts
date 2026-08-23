import type { InvoiceType } from "@prisma/client";

export const TYPE_VARIANTS: Record<InvoiceType, { color: string; bg: string; border: string; labelKey: string }> = {
  STANDARD: {
    color: "text-gray-700",
    bg: "bg-gray-100",
    border: "border-gray-200",
    labelKey: "standard",
  },
  PROGRESS: {
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    labelKey: "progress",
  },
  RECURRING: {
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    labelKey: "recurring",
  },
};

export function getTypeLabel(type: InvoiceType, t: (key: string) => string): string {
  const variant = TYPE_VARIANTS[type];
  if (!variant) return type;
  try {
    return t(variant["labelKey"]);
  } catch {
    return type;
  }
}

export function getTypeBadgeClass(type: InvoiceType): string {
  const variant = TYPE_VARIANTS[type];
  if (!variant) return "bg-gray-100 text-gray-700 border-gray-200";
  return `${variant["bg"]} ${variant["color"]} ${variant["border"]} border`;
}
