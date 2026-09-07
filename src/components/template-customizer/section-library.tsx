"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

const SECTION_LABELS: Record<string, string> = {
  business_info: "Business Information",
  customer_info: "Customer Information",
  project_info: "Project Information",
  invoice_details: "Invoice Details",
  line_items: "Line Items",
  labor_table: "Labor Table",
  materials_table: "Materials Table",
  equipment_table: "Equipment Table",
  change_orders: "Change Orders",
  schedule_of_values: "Schedule of Values",
  retainage: "Retainage",
  previous_payments: "Previous Payments",
  discounts: "Discounts",
  taxes: "Taxes",
  payment_summary: "Payment Summary",
  payment_terms: "Payment Terms",
  notes: "Notes",
  terms: "Terms & Conditions",
  signature: "Signature",
  photos: "Photos",
  attachments: "Attachments",
  qr_code: "QR Code",
  payment_button: "Payment Button",
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  business_info: "Company logo, name, and contact details",
  customer_info: "Customer billing and shipping information",
  project_info: "Project name, number, and location",
  invoice_details: "Invoice number, dates, and status",
  line_items: "Standard line item table",
  labor_table: "Labor hours, rates, and amounts",
  materials_table: "Material quantities and costs",
  equipment_table: "Equipment usage rates and costs",
  change_orders: "Change order list and amounts",
  schedule_of_values: "Progress billing line items",
  retainage: "Retainage rate and held amount",
  previous_payments: "Previous payment history",
  discounts: "Discount breakdown",
  taxes: "Tax breakdown",
  payment_summary: "Subtotal, tax, and total summary",
  payment_terms: "Payment terms and due date info",
  notes: "Additional notes for the customer",
  terms: "Terms and conditions text",
  signature: "Digital signature display",
  photos: "Project photos gallery",
  attachments: "Document attachments",
  qr_code: "QR code for payment or verification",
  payment_button: "Online payment button",
};

interface SectionLibraryProps {
  availableSectionTypes: string[];
  onAddSection: (sectionType: string) => void;
}

export function SectionLibrary({ availableSectionTypes, onAddSection }: SectionLibraryProps) {
  const t = useTranslations("invoiceTemplates");

  if (!availableSectionTypes || availableSectionTypes.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">
        {t("noMoreSections")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {availableSectionTypes.map((sectionType) => (
        <div
          key={sectionType}
          className="p-3 border rounded-lg hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">
                {SECTION_LABELS[sectionType] || sectionType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              </p>
              <p className="text-xs text-gray-500">
                {SECTION_DESCRIPTIONS[sectionType] || ""}
              </p>
            </div>
            <button
              onClick={() => onAddSection(sectionType)}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
