"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import type {
  InvoiceTemplateConfig,
  InvoiceSectionConfig,
} from "@/lib/invoice-template-config";
import { getDefaultTemplate } from "@/lib/invoice-template-config";
import { evaluateTemplate } from "@/lib/conditional-logic";
import { SectionLibrary } from "@/components/template-customizer/section-library";
import { PropertiesPanel } from "@/components/template-customizer/properties-panel";
import { RenderSections } from "@/components/invoice-sections";
import { GripVertical, Trash2, Eye, EyeOff, Settings } from "lucide-react";

interface TemplateCustomizerProps {
  templateId?: string;
  initialTemplate?: InvoiceTemplateConfig;
  onSave?: (template: InvoiceTemplateConfig) => void;
  onCancel?: () => void;
}

export function TemplateCustomizer({ templateId, initialTemplate, onSave, onCancel }: TemplateCustomizerProps) {
  const t = useTranslations("invoiceTemplates");
  const [template, setTemplate] = useState<InvoiceTemplateConfig>(
    initialTemplate ?? getDefaultTemplate("STANDARD")
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    initialTemplate?.sections?.[0]?.id ?? null
  );
  const [draggedSection, setDraggedSection] = useState<string | null>(null);

  const handleDragStart = (id: string) => {
    setDraggedSection(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedSection || draggedSection === targetId) return;

    const sections = [...template.sections];
    const sourceIdx = sections.findIndex((s) => s.id === draggedSection);
    const targetIdx = sections.findIndex((s) => s.id === targetId);

    if (sourceIdx < 0 || targetIdx < 0) return;

    const [removed] = sections.splice(sourceIdx, 1);
    sections.splice(targetIdx, 0, removed);

    setTemplate({
      ...template,
      sections: sections.map((s, idx) => ({ ...s, position: idx })),
    });
    setDraggedSection(null);
  };

  const addSection = useCallback((sectionType: string) => {
    const newSection: InvoiceSectionConfig = {
      id: `${sectionType}_${Date.now()}`,
      type: sectionType as any,
      name: sectionType,
      label: sectionType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      visible: true,
      collapsible: true,
      collapsed: false,
      position: template.sections.length,
      required: false,
      fields: [],
    };
    setTemplate((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setSelectedSectionId(newSection.id);
  }, [template]);

  const removeSection = useCallback((sectionId: string) => {
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    }));
    setSelectedSectionId(null);
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, visible: !s.visible } : s
      ),
    }));
  }, []);

  const updateSection = useCallback((sectionId: string, updates: Partial<InvoiceSectionConfig>) => {
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, ...updates } : s
      ),
    }));
  }, []);

  const handleSave = () => {
    onSave?.(template);
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const selectedSection = template.sections.find((s) => s.id === selectedSectionId);

  const availableSectionTypes = [
      "business_info", "customer_info", "project_info", "invoice_details",
      "line_items", "labor_table", "materials_table", "equipment_table",
      "change_orders", "schedule_of_values", "retainage", "previous_payments",
      "discounts", "taxes", "payment_summary", "payment_terms",
      "notes", "terms", "signature", "photos", "attachments",
      "qr_code", "payment_button"
    ].filter((type) => !template.sections.some((s) => s.type === type));

  const { visibleSections } = React.useMemo(() => {
    return evaluateTemplate(template, {});
  }, [template]);

  const sortedSections = [...visibleSections].sort((a, b) => a.position - b.position);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <div className="w-72 border-r bg-gray-50 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{t("sectionLibrary")}</h2>
        <SectionLibrary availableSectionTypes={availableSectionTypes} onAddSection={addSection} />
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{t("sections")}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {sortedSections.length} {t("sectionsTotal")}
        </p>

        <div className="space-y-2">
          {sortedSections.map((section, index) => {
            const isSelected = selectedSectionId === section.id;
            const isHidden = !section.visible;
            return (
              <div
                key={section.id}
                draggable
                onDragStart={() => handleDragStart(section.id)}
                onDragOver={(e) => handleDragOver(e, section.id)}
                onDrop={(e) => handleDrop(e, section.id)}
                onClick={() => setSelectedSectionId(section.id)}
                className={`
                  relative p-3 border rounded-lg cursor-pointer transition-all select-none
                  ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}
                  ${isHidden ? "opacity-50" : ""}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
                    <span className="font-medium text-sm">
                      {section.label || section.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!section.visible && (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSection(section.id);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {section.visible ? (
                        <Eye className="h-4 w-4 text-gray-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSection(section.id);
                      }}
                      className="p-1 hover:bg-red-100 rounded text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {sortedSections.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>{t("noVisibleSections")}</p>
            <p className="text-sm mt-2">{t("addFromLibrary")}</p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t">
          <h2 className="text-lg font-semibold mb-4">{t("renderedPreview")}</h2>
          <div className="border rounded-lg p-6 bg-white shadow max-w-3xl mx-auto">
            <RenderSections
              sections={template.sections}
              invoice={{
                number: "INV-001",
                type: "STANDARD",
                issueDate: "2024-01-15",
                dueDate: "2024-02-15",
                status: "draft",
                currency: "USD",
                subtotal: 1000,
                taxAmount: 80,
                total: 1080,
                amountPaid: 0,
                items: [
                  { id: "1", description: "Sample item", quantity: 10, unitPrice: 100, amount: 1000 },
                ],
              }}
            />
          </div>
        </div>
      </div>

      <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
        {selectedSection ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t("properties")}</h2>
              <Settings className="h-4 w-4 text-gray-400" />
            </div>
            <PropertiesPanel
              section={selectedSection}
              onUpdate={updateSection}
            />
          </>
        ) : (
          <div className="text-sm text-gray-500 py-8">
            <p>{t("selectSection")}</p>
          </div>
        )}

        <div className="mt-6 pt-4 border-t space-y-2">
          <button
            onClick={handleSave}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {t("save")}
          </button>
          <button
            onClick={handleCancel}
            className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
