"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import type {
  InvoiceTemplateConfig,
  InvoiceSectionConfig,
  SectionType,
} from "@/lib/invoice-template-config";
import {
  getDefaultTemplate,
  ALL_SECTION_TYPES,
  createTemplateSection,
  reorderTemplateSections,
  removeTemplateSection,
} from "@/lib/invoice-template-config";
import { evaluateTemplate } from "@/lib/conditional-logic";
import { SectionLibrary } from "@/components/template-customizer/section-library";
import { PropertiesPanel } from "@/components/template-customizer/properties-panel";
import { RenderSections } from "@/components/invoice-sections";
import { GripVertical, Trash2, Eye, EyeOff, Settings } from "lucide-react";

const SECTION_TYPE_DATA = "application/x-section-type";
const SECTION_ID_DATA = "application/x-section-id";

type DraggedItem =
  | { kind: "reorder"; id: string }
  | { kind: "library"; type: SectionType };

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
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const availableSectionTypes = ALL_SECTION_TYPES.filter(
    (type) => !template.sections.some((s) => s.type === type)
  );

  const { visibleSections } = React.useMemo(
    () => evaluateTemplate(template, {}),
    [template]
  );

  const sortedSections = [...visibleSections].sort((a, b) => a.position - b.position);

  const addSection = useCallback(
    (sectionType: SectionType) => {
      const newSection = createTemplateSection(sectionType, template.sections.length);
      setTemplate((prev) => ({
        ...prev,
        sections: [...prev.sections, newSection],
      }));
      setSelectedSectionId(newSection.id);
    },
    [template]
  );

  const insertSectionBefore = useCallback(
    (sectionType: SectionType, beforeId: string) => {
      const beforeIdx = template.sections.findIndex((s) => s.id === beforeId);
      const insertAt = beforeIdx < 0 ? template.sections.length : beforeIdx;
      const newSection = createTemplateSection(sectionType, insertAt);
      const updated = [
        ...template.sections.slice(0, insertAt),
        newSection,
        ...template.sections.slice(insertAt),
      ].map((s, idx) => ({ ...s, position: idx }));
      setTemplate({ ...template, sections: updated });
      setSelectedSectionId(newSection.id);
    },
    [template]
  );

  const reorderSection = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      setTemplate((prev) => ({
        ...prev,
        sections: reorderTemplateSections(prev.sections, sourceId, targetId),
      }));
    },
    []
  );

  const removeSection = useCallback((sectionId: string) => {
    setTemplate((prev) => ({
      ...prev,
      sections: removeTemplateSection(prev.sections, sectionId),
    }));
    setSelectedSectionId((prev) => (prev === sectionId ? null : prev));
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

  const handleLibraryDragStart = (sectionType: SectionType) => {
    setDraggedItem({ kind: "library", type: sectionType });
  };

  const handleSectionDragStart = (id: string) => {
    setDraggedItem({ kind: "reorder", id });
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedItem?.kind === "library" ? "copy" : "move";
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const sectionType = e.dataTransfer.getData(SECTION_TYPE_DATA);
    const sectionId = e.dataTransfer.getData(SECTION_ID_DATA);
    if (sectionType && draggedItem?.kind === "library") {
      addSection(sectionType as SectionType);
    } else if (sectionId && draggedItem?.kind === "reorder") {
      const lastVisible = sortedSections[sortedSections.length - 1];
      if (lastVisible && draggedItem.id !== lastVisible.id) {
        reorderSection(draggedItem.id, lastVisible.id);
      }
    }
    setDraggedItem(null);
    setDragOverId(null);
  };

  const handleSectionDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sectionId = e.dataTransfer.getData(SECTION_ID_DATA);
    const sectionType = e.dataTransfer.getData(SECTION_TYPE_DATA);
    if (sectionId) {
      e.dataTransfer.dropEffect = "move";
    } else if (sectionType) {
      e.dataTransfer.dropEffect = "copy";
    }
    setDragOverId(targetId);
  };

  const handleSectionDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sectionId = e.dataTransfer.getData(SECTION_ID_DATA);
    const sectionType = e.dataTransfer.getData(SECTION_TYPE_DATA);

    if (sectionType && draggedItem?.kind === "library") {
      insertSectionBefore(sectionType as SectionType, targetId);
    } else if (sectionId && draggedItem?.kind === "reorder") {
      reorderSection(draggedItem.id, targetId);
    }
    setDraggedItem(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverId(null);
  };

  const handleSave = () => {
    onSave?.(template);
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const selectedSection = template.sections.find((s) => s.id === selectedSectionId);

  const canAddMore = availableSectionTypes.length > 0;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <div className="w-72 border-r bg-gray-50 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{t("sectionLibrary")}</h2>
        <p className="text-xs text-gray-500 mb-2">
          {canAddMore
            ? `${availableSectionTypes.length} ${t("typesAvailable")}`
            : t("noMoreSections")}
        </p>
        <SectionLibrary
          availableSectionTypes={availableSectionTypes}
          onAddSection={addSection}
          onDragStart={handleLibraryDragStart}
        />
        {!canAddMore && (
          <p className="text-xs text-gray-500 mt-3">{t("allSectionsAdded")}</p>
        )}
      </div>

      <div
        className="flex-1 p-6 overflow-y-auto"
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
        onDragEnd={handleDragEnd}
      >
        <h2 className="text-lg font-semibold mb-4">{t("sections")}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {sortedSections.length} {t("sectionsTotal")}
        </p>

        <div className="space-y-2">
          {sortedSections.map((section) => {
            const isSelected = selectedSectionId === section.id;
            const isHidden = !section.visible;
            const isDropTarget = dragOverId === section.id;
            return (
              <React.Fragment key={section.id}>
                {isDropTarget && (
                  <div className="h-0.5 w-full bg-blue-400 rounded" />
                )}
                <div
                  draggable
                  onDragStart={() => handleSectionDragStart(section.id)}
                  onDragOver={(e) => handleSectionDragOver(e, section.id)}
                  onDrop={(e) => handleSectionDrop(e, section.id)}
                  onClick={() => setSelectedSectionId(section.id)}
                  className={`
                    relative p-3 border rounded-lg cursor-grab transition-all select-none
                    ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}
                    ${isHidden ? "opacity-50" : ""}
                    ${isDropTarget ? "ring-2 ring-blue-300 ring-inset" : ""}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
                      <span className="font-medium text-sm">
                        {section.label || section.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      {!section.visible && <EyeOff className="h-3 w-3 text-gray-400" />}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSection(section.id);
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                        aria-label={section.visible ? t("hideSection") : t("showSection")}
                      >
                        {section.visible ? (
                          <Eye className="h-4 w-4 text-gray-500" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSection(section.id);
                        }}
                        className="p-1 hover:bg-red-100 rounded text-red-500"
                        aria-label={t("removeSection")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {sortedSections.length === 0 && (
          <div
            className="text-center py-12 text-gray-400 border-2 border-dashed rounded-lg"
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
          >
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
            type="button"
            onClick={handleSave}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {t("save")}
          </button>
          <button
            type="button"
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
