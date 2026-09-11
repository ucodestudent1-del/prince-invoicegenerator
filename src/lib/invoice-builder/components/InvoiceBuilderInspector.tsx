"use client";

import React, { useState } from "react";
import { useEditor, useSelectedComponent } from "../editor-context";
import { componentRegistry, ComponentSchema } from "../component-registry";
import { BaseComponent } from "../document-model";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  SlidersHorizontal,
  Palette,
  Type,
  Layout,
  Trash2,
  Copy,
} from "lucide-react";
import { getIconComponent } from "../icon-registry";

const COMMON_STYLE_PROPS = [
  { key: "fontSize", label: "Font Size", type: "number" as const, min: 8, max: 72, step: 1, unit: "px" },
  { key: "fontWeight", label: "Font Weight", type: "select" as const, options: ["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"] },
  { key: "color", label: "Text Color", type: "color" as const },
  { key: "backgroundColor", label: "Background", type: "color" as const },
  { key: "textAlign", label: "Text Align", type: "select" as const, options: ["left", "center", "right"] },
  { key: "padding", label: "Padding", type: "text" as const, placeholder: "e.g., 16px 24px" },
  { key: "margin", label: "Margin", type: "text" as const, placeholder: "e.g., 8px 0" },
  { key: "borderRadius", label: "Border Radius", type: "text" as const, placeholder: "e.g., 8px" },
  { key: "borderWidth", label: "Border Width", type: "text" as const, placeholder: "e.g., 1px" },
  { key: "borderColor", label: "Border Color", type: "color" as const },
  { key: "borderStyle", label: "Border Style", type: "select" as const, options: ["solid", "dashed", "dotted", "double", "none"] },
];

const LAYOUT_STYLE_PROPS = [
  { key: "display", label: "Display", type: "select" as const, options: ["block", "flex", "grid", "inline-block"] },
  { key: "flexDirection", label: "Flex Direction", type: "select" as const, options: ["row", "column"] },
  { key: "justifyContent", label: "Justify Content", type: "select" as const, options: ["flex-start", "center", "flex-end", "space-between", "space-around"] },
  { key: "alignItems", label: "Align Items", type: "select" as const, options: ["flex-start", "center", "flex-end", "stretch"] },
  { key: "gap", label: "Gap", type: "text" as const, placeholder: "e.g., 16px" },
  { key: "gridTemplateColumns", label: "Grid Columns", type: "text" as const, placeholder: "e.g., 1fr 2fr 1fr" },
  { key: "width", label: "Width", type: "text" as const, placeholder: "e.g., 100%" },
  { key: "minWidth", label: "Min Width", type: "text" as const, placeholder: "e.g., 200px" },
  { key: "maxWidth", label: "Max Width", type: "text" as const, placeholder: "e.g., 800px" },
];

export function InvoiceBuilderInspector() {
  const { state, selectComponent, deleteComponent, duplicateComponent, updateComponentProps, updateComponentStyle, reorderComponent } = useEditor();
  const selectedComponent = useSelectedComponent();
  const [activeTab, setActiveTab] = useState("content");

  if (!selectedComponent) {
    return (
      <div className="h-full flex flex-col bg-white border-l overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Properties</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400 p-8">
          <div className="text-center">
            <SlidersHorizontal className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Select a component to edit its properties</p>
            <p className="text-xs text-gray-500 mt-1">Click on any component in the canvas</p>
          </div>
        </div>
      </div>
    );
  }

  const schema = componentRegistry[selectedComponent.type as keyof typeof componentRegistry];
  const isLayout = schema?.isLayout ?? false;

  const handlePropChange = (key: string, value: unknown) => {
    updateComponentProps(selectedComponent.id, { [key]: value });
  };

  const handleStyleChange = (key: string, value: string | number) => {
    updateComponentStyle(selectedComponent.id, { [key]: value });
  };

  const tabs = [
    { id: "content", label: "Content", icon: Type, show: !isLayout },
    { id: "style", label: "Style", icon: Palette, show: true },
    { id: "layout", label: "Layout", icon: Layout, show: isLayout },
  ].filter(t => t.show);

  return (
    <div className="h-full flex flex-col bg-white border-l overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Properties</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => duplicateComponent(selectedComponent.id)} title="Duplicate (Ctrl+D)">
            <Copy className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => deleteComponent(selectedComponent.id)} title="Delete" className="text-red-600 hover:text-red-700">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Tab buttons */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              size="sm"
              className="px-3 py-1.5 gap-1"
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "content" && (
          <TabsContentContent>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {schema?.icon && (() => {
                    const Icon = getIconComponent(schema.icon);
                    return <Icon className="w-4 h-4" />;
                  })()}
                  {schema?.label || selectedComponent.type}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {schema && !isLayout ? (
                  renderComponentProps(selectedComponent, schema, handlePropChange)
                ) : (
                  <p className="text-sm text-gray-500">No configurable properties for layout components</p>
                )}
              </CardContent>
            </Card>
          </TabsContentContent>
        )}

        {activeTab === "style" && (
          <TabsContentContent>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Typography & Appearance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {COMMON_STYLE_PROPS.map((prop) => (
                  <StyleControl
                    key={prop.key}
                    component={selectedComponent}
                    prop={prop}
                    onChange={handleStyleChange}
                  />
                ))}
              </CardContent>
            </Card>
          </TabsContentContent>
        )}

        {activeTab === "layout" && isLayout && (
          <TabsContentContent>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Layout Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {LAYOUT_STYLE_PROPS.map((prop) => (
                  <StyleControl
                    key={prop.key}
                    component={selectedComponent}
                    prop={prop}
                    onChange={handleStyleChange}
                  />
                ))}
              </CardContent>
            </Card>
          </TabsContentContent>
        )}

        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Component Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>ID</span>
              <code className="font-mono text-gray-900">{selectedComponent.id}</code>
            </div>
            <div className="flex justify-between">
              <span>Type</span>
              <code className="font-mono text-gray-900">{selectedComponent.type}</code>
            </div>
            <div className="flex justify-between">
              <span>Parent</span>
              <code className="font-mono text-gray-900">{selectedComponent.parentId || "none (root)"}</code>
            </div>
            <div className="flex justify-between">
              <span>Children</span>
              <code className="font-mono text-gray-900">{selectedComponent.children?.length || 0}</code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TabsContentContent({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function renderComponentProps(
  component: BaseComponent,
  schema: ComponentSchema,
  onChange: (key: string, value: unknown) => void
) {
  const props = component.props || {};
  const schemaShape = schema.schema.shape as Record<string, z.ZodTypeAny>;

  return Object.entries(schemaShape).map(([key, fieldSchema]) => {
    const value = props[key];
    const isRequired = fieldSchema._def?.checks?.some((c: any) => c.kind === "min") ?? false;

    return (
      <div key={key} className="space-y-1">
        <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
          {key}
          {isRequired && <span className="text-red-500">*</span>}
        </Label>
        {renderFieldInput(key, value, fieldSchema, onChange)}
      </div>
    );
  });
}

function renderFieldInput(
  key: string,
  value: unknown,
  fieldSchema: any,
  onChange: (key: string, value: unknown) => void
) {
  const def = fieldSchema._def;
  const typeName = def?.typeName || "ZodString";

  switch (typeName) {
    case "ZodString": {
      const enumValues = def?.values;
      if (enumValues) {
        return (
          <Select value={value as string} onValueChange={(v) => onChange(key, v)}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {enumValues.map((v: string) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      return (
        <Input
          value={value as string}
          onChange={(e) => onChange(key, e.target.value)}
          placeholder={`Enter ${key}`}
        />
      );
    }
    case "ZodNumber":
      return (
        <Input
          type="number"
          value={value as number}
          onChange={(e) => onChange(key, parseFloat(e.target.value) || 0)}
          className="w-24"
        />
      );
    case "ZodBoolean":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={value as boolean}
            onCheckedChange={(checked) => onChange(key, checked)}
          />
          <Label className="text-sm cursor-pointer">Enabled</Label>
        </div>
      );
    case "ZodArray":
      return (
        <div className="text-sm text-gray-500">
          Array field - configure in advanced settings
        </div>
      );
    default:
      return (
        <Input
          value={String(value ?? "")}
          onChange={(e) => onChange(key, e.target.value)}
          placeholder={`Enter ${key}`}
        />
      );
  }
}

interface StyleControlProps {
  component: BaseComponent;
  prop: {
    key: string;
    label: string;
    type: "text" | "number" | "color" | "select";
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    options?: string[];
    placeholder?: string;
  };
  onChange: (key: string, value: string | number) => void;
}

function StyleControl({ component, prop, onChange }: StyleControlProps) {
  const value = component.style?.[prop.key as keyof typeof component.style];

  if (prop.type === "color") {
    return (
      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium text-gray-700 w-32">{prop.label}</Label>
        <input
          type="color"
          value={value as string || "#000000"}
          onChange={(e) => onChange(prop.key, e.target.value)}
          className="w-8 h-8 rounded border"
        />
        <Input
          value={value as string || ""}
          onChange={(e) => onChange(prop.key, e.target.value)}
          placeholder={prop.placeholder}
          className="flex-1"
        />
      </div>
    );
  }

  if (prop.type === "select") {
    return (
      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium text-gray-700 w-32">{prop.label}</Label>
        <Select value={value as string} onValueChange={(v) => onChange(prop.key, v)}>
          <SelectTrigger className="h-8 flex-1">
            <SelectValue placeholder={prop.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {prop.options?.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (prop.type === "number") {
    return (
      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium text-gray-700 w-32">{prop.label}</Label>
        <Input
          type="number"
          value={value as number || prop.min || 0}
          onChange={(e) => onChange(prop.key, parseFloat(e.target.value) || 0)}
          min={prop.min}
          max={prop.max}
          step={prop.step}
          className="w-24"
        />
        {prop.unit && <span className="text-xs text-gray-500">{prop.unit}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs font-medium text-gray-700 w-32">{prop.label}</Label>
      <Input
        value={value as string || ""}
        onChange={(e) => onChange(prop.key, e.target.value)}
        placeholder={prop.placeholder}
        className="flex-1"
      />
    </div>
  );
}