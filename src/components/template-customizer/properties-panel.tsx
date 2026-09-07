"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import type { InvoiceSectionConfig } from "@/lib/invoice-template-config";

interface PropertiesPanelProps {
  section: InvoiceSectionConfig;
  onUpdate: (sectionId: string, updates: Partial<InvoiceSectionConfig>) => void;
}

export function PropertiesPanel({ section, onUpdate }: PropertiesPanelProps) {
  const t = useTranslations("invoiceTemplates");

  const updateField = (field: string, value: any) => {
    onUpdate(section.id, { ...section, [field]: value });
  };

  const conditionalOperator = section.conditional?.["operator"] ?? "equals";
  const conditionalValue = section.conditional?.["value"] ?? "";

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">{t("sectionLabel")}</label>
        <input
          type="text"
          value={section.label || ""}
          onChange={(e) => updateField("label", e.target.value)}
          className="w-full px-3 py-2 border rounded text-sm"
          placeholder="Section label"
        />
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-2">{t("visibility")}</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={section.visible ?? true}
            onChange={(e) => updateField("visible", e.target.checked)}
          />
          {t("sectionVisible")}
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{t("sectionPosition")}</label>
        <input
          type="number"
          value={section.position ?? 0}
          onChange={(e) => updateField("position", parseInt(e.target.value))}
          className="w-full px-3 py-2 border rounded text-sm"
        />
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-2">{t("conditionalLogic")}</h3>
        <div>
          <label className="block text-sm font-medium mb-1">{t("conditionalField")}</label>
          <input
            type="text"
            value={section.conditional?.fieldId || ""}
            onChange={(e) =>
              updateField("conditional", {
                ...(section.conditional ?? { operator: "equals", value: "" }),
                fieldId: e.target.value,
              })
            }
            className="w-full px-3 py-2 border rounded text-sm"
            placeholder="Field ID to watch"
          />
        </div>

        {section.conditional && (
          <div className="mt-2">
            <label className="block text-sm font-medium mb-1">{t("conditionalOperator")}</label>
            <select
              value={conditionalOperator}
              onChange={(e) =>
                updateField("conditional", {
                  ...section.conditional,
                  operator: e.target.value,
                })
              }
              className="w-full px-3 py-2 border rounded text-sm"
            >
              <option value="equals">Equals</option>
              <option value="not_equals">Not Equals</option>
              <option value="exists">Exists</option>
              <option value="not_exists">Not Exists</option>
              <option value="greater_than">Greater Than</option>
              <option value="less_than">Less Than</option>
              <option value="contains">Contains</option>
              <option value="not_contains">Not Contains</option>
              <option value="in">In</option>
              <option value="not_in">Not In</option>
            </select>
          </div>
        )}

        {section.conditional && (
          <div className="mt-2">
            <label className="block text-sm font-medium mb-1">{t("conditionalValue")}</label>
            <input
              type="text"
              value={typeof conditionalValue === "string" ? conditionalValue : String(conditionalValue ?? "")}
              onChange={(e) =>
                updateField("conditional", {
                  ...section.conditional,
                  value: e.target.value,
                })
              }
              className="w-full px-3 py-2 border rounded text-sm"
              placeholder="Value to compare"
            />
          </div>
        )}

        {section.conditional && (
          <button
            onClick={() => updateField("conditional", undefined)}
            className="mt-2 text-xs text-red-500 hover:underline"
          >
            {t("removeConditional")}
          </button>
        )}
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-2">{t("styling")}</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={section.collapsible ?? false}
              onChange={(e) => updateField("collapsible", e.target.checked)}
            />
            {t("collapsible")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={section.collapsed ?? false}
              onChange={(e) => updateField("collapsed", e.target.checked)}
            />
            {t("collapsed")}
          </label>
        </div>
      </div>
    </div>
  );
}
