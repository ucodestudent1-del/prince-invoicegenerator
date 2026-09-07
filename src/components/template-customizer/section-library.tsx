"use client";

import * as React from "react";
import { Plus, GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { getSectionLabel, type SectionType } from "@/lib/invoice-template-config";

const SECTION_DESCRIPTIONS: Partial<Record<SectionType, string>> = {
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
  milestone_info: "Milestone title, description, and amount",
  custom_field: "A free-form custom field",
};

interface SectionLibraryProps {
  availableSectionTypes: SectionType[];
  onAddSection: (sectionType: SectionType) => void;
  onDragStart: (sectionType: SectionType) => void;
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

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, sectionType: SectionType) => {
    e.dataTransfer.setData("application/x-section-type", sectionType);
    e.dataTransfer.setData("text/plain", getSectionLabel(sectionType));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="space-y-2">
      {availableSectionTypes.map((sectionType) => {
        const label = getSectionLabel(sectionType);
        return (
          <div
            key={sectionType}
            draggable
            onDragStart={(e) => handleDragStart(e, sectionType)}
            className="p-3 border rounded-lg hover:bg-gray-100 transition-colors cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-2">
                <GripVertical className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-gray-500">
                    {SECTION_DESCRIPTIONS[sectionType] || ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onAddSection(sectionType)}
                className="p-1 hover:bg-gray-200 rounded"
                aria-label={`Add ${label}`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
