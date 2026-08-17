"use client";

import * as React from "react";

const sampleItems = [
  { description: "General contractor services", quantity: 1, unitPrice: 2500, amount: 2500 },
  { description: "Project management", quantity: 1, unitPrice: 1200, amount: 1200 },
];

export function TemplatePreview({
  template,
  brandColor,
  accentColor,
  fontFamily,
  layout,
}: {
  template: string;
  brandColor?: string;
  accentColor?: string;
  fontFamily?: string;
  layout?: string;
}) {
  const templateClass = `template-${template?.toLowerCase?.() ?? "regular_invoice"}`;
  const layoutClass = `layout-${layout ?? "default"}`;

  const documentTitle =
    template === "TAX_INVOICE"
      ? "TAX INVOICE"
      : template === "PROFORMA_INVOICE"
        ? "PROFORMA INVOICE"
        : template === "RECEIPT"
          ? "RECEIPT"
          : "INVOICE";

  const badgeColor =
    template === "TAX_INVOICE"
      ? "bg-blue-100 text-blue-700 border border-blue-200"
      : template === "PROFORMA_INVOICE"
        ? "bg-amber-100 text-amber-700 border border-amber-200"
        : template === "RECEIPT"
          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
          : "text-gray-600";

  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Preview</h3>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div
          className={`mx-auto max-w-2xl p-6 text-black ${templateClass} ${layoutClass}`}
          style={fontFamily ? { fontFamily } : undefined}
        >
          <div className="invoice-header flex items-start justify-between pb-4 mb-4 border-b border-gray-200">
            <div>
              <p className="text-lg font-semibold" style={brandColor ? { color: brandColor } : undefined}>
                Acme Construction
              </p>
              <p className="text-xs text-gray-500">General Contractors</p>
            </div>
            <div className="text-right">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badgeColor}`}
                style={
                  brandColor && template === "REGULAR_INVOICE"
                    ? { backgroundColor: brandColor, color: "#fff" }
                    : undefined
                }
              >
                {documentTitle}
              </span>
              <p className="text-sm font-bold mt-1">INV-001</p>
              <p className="text-xs text-gray-500">Issued Aug 1, 2026</p>
              <p className="text-xs text-gray-500">Due Aug 15, 2026</p>
            </div>
          </div>

          <div className="mb-4 text-sm">
            <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">Bill To</p>
            <p className="font-medium">Sample Customer</p>
            <p>123 Main Street</p>
            <p>Springfield, USA</p>
          </div>

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-1 text-xs font-semibold">Description</th>
                <th className="py-1 text-xs font-semibold text-right">Qty</th>
                <th className="py-1 text-xs font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sampleItems.map((it, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-1 text-xs">{it.description}</td>
                  <td className="py-1 text-xs text-right">{it.quantity}</td>
                  <td className="py-1 text-xs text-right font-medium">${it.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-48 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>$3,700.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tax (10%)</span>
                <span>$370.00</span>
              </div>
              <div
                className="border-t pt-1 mt-1 flex justify-between text-sm font-bold"
                style={accentColor ? { borderColor: accentColor, color: accentColor } : undefined}
              >
                <span>Total</span>
                <span>$4,070.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
