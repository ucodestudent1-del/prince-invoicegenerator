import type { InvoiceType } from "@prisma/client";

export const TYPE_VARIANTS: Record<InvoiceType, { color: string; bg: string; border: string; labelKey: string }> = {
  STANDARD: {
    color: "text-gray-700",
    bg: "bg-gray-100",
    border: "border-gray-200",
    labelKey: "standard",
  },
  FIXED_PRICE: {
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    labelKey: "fixedPrice",
  },
  TIME_AND_MATERIALS: {
    color: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
    labelKey: "timeAndMaterials",
  },
  PROGRESS: {
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    labelKey: "progress",
  },
  MILESTONE: {
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    labelKey: "milestone",
  },
  CHANGE_ORDER: {
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    labelKey: "changeOrder",
  },
  DEPOSIT: {
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    labelKey: "deposit",
  },
  RETAINAGE: {
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    labelKey: "retainage",
  },
  FINAL: {
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    labelKey: "final",
  },
  RECURRING: {
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    labelKey: "recurring",
  },
  EXPENSE: {
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    labelKey: "expense",
  },
  CUSTOM: {
    color: "text-slate-700",
    bg: "bg-slate-100",
    border: "border-slate-200",
    labelKey: "custom",
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
