"use client";

import React, { useRef, useEffect } from "react";
import { useEditor, useDocument, useSelectedComponent, useChildren } from "../editor-context";
import { componentRegistry } from "../component-registry";
import { BaseComponent, AllComponentType } from "../document-model";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  Copy,
  GripVertical,
  Settings,
  Plus,
} from "lucide-react";
import { getIconComponentForType } from "../icon-registry";

interface ComponentRendererProps {
  component: BaseComponent;
  depth?: number;
  isSelected?: boolean;
  isDropTarget?: boolean;
  dropPosition?: "before" | "after" | "inside";
}

export function InvoiceBuilderCanvas() {
  const { state, selectComponent, deleteComponent, duplicateComponent } = useEditor();
  const document = useDocument();
  const canvasRef = useRef<HTMLDivElement>(null);

  const rootComponents = state.document.rootIds
    .map((id) => document.components.get(id))
    .filter(Boolean);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;

    try {
      const item = JSON.parse(data);
      if (item.type === "palette" && item.componentType) {
        if (rootComponents.length > 0) {
          const firstRoot = rootComponents[0];
          if (firstRoot) {
            const firstColumn = findFirstColumn(document, firstRoot.id);
            if (firstColumn) {
              // This would be handled by the editor context
            }
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  return (
    <div
      ref={canvasRef}
      className="flex-1 overflow-auto bg-gray-100 relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="min-h-screen w-full max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden min-h-[297mm]">
          {/* Page header */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Invoice Canvas</h2>
              <span className="text-sm text-gray-500">
                {document.components.size} components
              </span>
            </div>
          </div>

          {/* Canvas content */}
          <div className="p-6 space-y-4">
            {rootComponents.length === 0 ? (
              <EmptyCanvasState />
            ) : (
              rootComponents.map((component) => (
                <ComponentRenderer
                  key={component!.id}
                  component={component!}
                  depth={0}
                  isSelected={state.selectedId === component!.id}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCanvasState() {
  const { insertComponent } = useEditor();

  return (
    <div className="h-[200mm] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-lg p-12">
      <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center mb-4">
        <Plus className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-medium text-gray-600 mb-2">Empty Invoice</h3>
      <p className="text-gray-500 mb-6 max-w-md text-center">
        Drag components from the palette to start building your invoice, or click below to add a section.
      </p>
      <Button
        onClick={() => {
          // Add a default section with row and column
        }}
        className="gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Section
      </Button>
    </div>
  );
}

function findFirstColumn(document: ReturnType<typeof useDocument>, sectionId: string): string | null {
  const section = document.components.get(sectionId);
  if (!section?.children) return null;

  for (const rowId of section.children) {
    const row = document.components.get(rowId);
    if (row?.children) {
      for (const colId of row.children) {
        const col = document.components.get(colId);
        if (col?.type === "column") return colId;
      }
    }
  }
  return null;
}

export function ComponentRenderer({
  component,
  depth = 0,
  isSelected = false,
  isDropTarget = false,
  dropPosition,
}: ComponentRendererProps) {
  const { selectComponent, deleteComponent, duplicateComponent, updateComponentProps, updateComponentStyle } = useEditor();
  const document = useDocument();
  const children = useChildren(component.id);
  const schema = componentRegistry[component.type as AllComponentType];

  const isLayout = schema?.isLayout ?? false;
  const isRoot = depth === 0 && !component.parentId;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectComponent(component.id);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "canvas", componentId: component.id, sourceId: component.parentId })
    );
    e.currentTarget.classList.add("dragging");
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("dragging");
  };

  const handleDragOver = (e: React.DragEvent, position: "before" | "after" | "inside") => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, position: "before" | "after" | "inside") => {
    e.preventDefault();
    e.stopPropagation();
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;

    try {
      const item = JSON.parse(data);
      // Drop handling would be done via editor context
    } catch {
      // Ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteComponent(component.id);
    } else if (e.key === "d" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      duplicateComponent(component.id);
    }
  };

  const renderComponentContent = () => {
    if (isLayout) {
      return renderLayoutComponent(component, children);
    }
    return renderContentComponent(component);
  };

  const dropIndicatorClass = isDropTarget
    ? dropPosition === "before"
      ? "border-t-2 border-blue-500 -mt-1"
      : dropPosition === "after"
      ? "border-b-2 border-blue-500 -mb-1"
      : "ring-2 ring-blue-500 ring-inset"
    : "";

  return (
    <div
      className={`group relative ${dropIndicatorClass} ${isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${component.type} component`}
      aria-pressed={isSelected}
      draggable={!isRoot}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => handleDragOver(e, "inside")}
      onDrop={(e) => handleDrop(e, "inside")}
    >
      {/* Drop zone before */}
      <div
        className="h-1 w-full transition-colors"
        onDragOver={(e) => handleDragOver(e, "before")}
        onDrop={(e) => handleDrop(e, "before")}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            // Handle leave
          }
        }}
      />

      {/* Component wrapper */}
      <div
        className={`p-2 ${isLayout ? "bg-gray-50 border border-gray-200 rounded" : "bg-white border border-gray-200 rounded"}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          <button
            className="p-1 text-gray-300 hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          {/* Component content */}
          <div className="flex-1 min-w-0" onClick={handleClick}>
            {renderComponentContent()}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                duplicateComponent(component.id);
              }}
              aria-label="Duplicate"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete ${schema?.label || component.type}?`)) {
                  deleteComponent(component.id);
                }
              }}
              aria-label="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Component props preview for content components */}
        {!isLayout && component.props && Object.keys(component.props).length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
            {Object.entries(component.props)
              .filter(([, v]) => v !== "" && v !== null && v !== undefined)
              .slice(0, 3)
              .map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="font-medium text-gray-600 w-24 truncate">{key}:</span>
                  <span className="truncate">{String(value)}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Drop zone after */}
      <div
        className="h-1 w-full transition-colors"
        onDragOver={(e) => handleDragOver(e, "after")}
        onDrop={(e) => handleDrop(e, "after")}
      />
    </div>
  );
}

function renderLayoutComponent(component: BaseComponent, children: BaseComponent[]) {
  const schema = componentRegistry[component.type as AllComponentType];
  const Icon = getLayoutIcon(component.type);

  if (children.length === 0) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-4 px-4 border-2 border-dashed border-gray-300 rounded">
        <Icon className="w-5 h-5" />
        <span className="font-medium">{schema?.label || component.type}</span>
        <span className="text-xs text-gray-500">(empty)</span>
        <div className="flex-1" />
        <span className="text-xs text-gray-400">Drop components here</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Icon className="w-4 h-4 text-gray-400" />
        <span>{schema?.label || component.type}</span>
        <span className="text-xs text-gray-400">({children.length} children)</span>
      </div>
      <div className="space-y-2 ml-4">
        {children.map((child) => (
          <ComponentRenderer key={child.id} component={child} depth={1} />
        ))}
      </div>
    </div>
  );
}

function renderContentComponent(component: BaseComponent) {
  const schema = componentRegistry[component.type as AllComponentType];
  const Icon = getContentIcon(component.type);
  const props = component.props as Record<string, unknown>;

  const hasContent = typeof props.content === "string" && props.content.length > 0;
  const hasLabel = typeof props.label === "string" && props.label.length > 0;
  const hasFields = Array.isArray(props.fields) && props.fields.length > 0;

  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{schema?.label || component.type}</p>
        {hasContent && (
          <p className="text-xs text-gray-500 truncate max-w-xs">
            {String(props.content).slice(0, 50)}
          </p>
        )}
        {hasLabel && !hasContent && (
          <p className="text-xs text-gray-500 truncate max-w-xs">
            Label: {String(props.label).slice(0, 30)}
          </p>
        )}
        {hasFields && (
          <p className="text-xs text-gray-500">
            Fields: {Array.isArray(props.fields) ? props.fields.join(", ") : "custom"}
          </p>
        )}
      </div>
    </div>
  );
}

function getLayoutIcon(type: string) {
  return getIconComponentForType(type);
}

function getContentIcon(type: string) {
  return getIconComponentForType(type);
}