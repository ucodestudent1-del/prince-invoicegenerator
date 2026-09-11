"use client";

import React, { useState } from "react";
import { useEditor } from "../editor-context";
import { componentRegistry, getComponentsByCategory, getPaletteCategories, ComponentSchema } from "../component-registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Layout,
  Building,
  FileText,
  Calculator,
  Settings,
  Search,
  ChevronDown,
  ChevronRight,
  GripVertical,
} from "lucide-react";

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  layout: Layout,
  business: Building,
  content: FileText,
  totals: Calculator,
  advanced: Settings,
};

export function InvoiceBuilderPalette() {
  const { insertComponent, state } = useEditor();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    layout: true,
    business: true,
    content: true,
    totals: true,
    advanced: false,
  });

  const categories = getPaletteCategories();

  const filteredComponents = React.useMemo(() => {
    const results: Array<{ category: string; component: ComponentSchema }> = [];
    for (const category of categories) {
      const components = getComponentsByCategory(category.key as any);
      for (const component of components) {
        if (
          component.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          component.description.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          results.push({ category: category.key, component });
        }
      }
    }
    return results;
  }, [categories, searchQuery]);

  const handleDragStart = (e: React.DragEvent, componentType: string) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("application/json", JSON.stringify({ type: "palette", componentType }));
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="h-full flex flex-col bg-white border-r overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Components</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-3 pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {filteredComponents.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
              Search Results
            </h3>
            {filteredComponents.map(({ component }) => (
              <PaletteItem key={component.type} component={component} onDragStart={handleDragStart} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map((category) => {
              const components = getComponentsByCategory(category.key as any);
              const Icon = categoryIcons[category.key] || Settings;
              const isExpanded = expandedCategories[category.key];

              return (
                <div key={category.key} className="border rounded-lg overflow-hidden bg-gray-50">
                  <button
                    onClick={() => toggleCategory(category.key)}
                    className="w-full px-3 py-2 flex items-center gap-2 text-left bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">{category.label}</span>
                    <span className="ml-auto text-xs text-gray-500">{components.length}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                      {components.map((component) => (
                        <PaletteItem key={component.type} component={component} onDragStart={handleDragStart} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-3 border-t bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          Drag components to the canvas to build your invoice
        </p>
      </div>
    </div>
  );
}

interface PaletteItemProps {
  component: ComponentSchema;
  onDragStart: (e: React.DragEvent, componentType: string) => void;
}

function PaletteItem({ component, onDragStart }: PaletteItemProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, component.type)}
      className="group px-3 py-2 rounded-lg bg-white border border-gray-200 hover:border-blue-300 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all"
      role="button"
      tabIndex={0}
      aria-label={`Add ${component.label}`}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{component.label}</p>
          <p className="text-xs text-gray-500 truncate">{component.description}</p>
        </div>
      </div>
    </div>
  );
}