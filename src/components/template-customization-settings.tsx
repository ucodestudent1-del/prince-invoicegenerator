"use client";

import * as React from "react";
import { TemplateEditor } from "@/components/template-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fonts = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Merriweather", label: "Merriweather" },
  { value: "Source Sans Pro", label: "Source Sans Pro" },
];

const layouts = [
  { value: "default", label: "Default (full width)" },
  { value: "compact", label: "Compact (boxed)" },
  { value: "sidebar", label: "Sidebar layout" },
];

export function TemplateCustomizationSettings({
  current,
  brandColor,
  accentColor,
  fontFamily,
  layout,
}: {
  current: string;
  brandColor?: string;
  accentColor?: string;
  fontFamily?: string;
  layout?: string;
}) {
  const [selected, setSelected] = React.useState(current);
  const [localBrandColor, setLocalBrandColor] = React.useState(brandColor || "#ea5804");
  const [localAccentColor, setLocalAccentColor] = React.useState(accentColor || "#ea5804");
  const [localFontFamily, setLocalFontFamily] = React.useState(fontFamily || "");
  const [localLayout, setLocalLayout] = React.useState(layout || "default");
  const [saving, setSaving] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function saveColors() {
    setSaving("colors");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/customization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "colors",
          brandColor: localBrandColor,
          accentColor: localAccentColor,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save colors.");
      }
      setSuccess("Colors saved successfully.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  async function saveFont() {
    setSaving("font");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/customization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "fonts", value: localFontFamily }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save font.");
      }
      setSuccess("Font saved successfully.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  async function saveLayout() {
    setSaving("layout");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/customization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "layout", value: localLayout }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save layout.");
      }
      setSuccess("Layout saved successfully.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <TemplateEditor
        current={selected}
        brandColor={localBrandColor}
        accentColor={localAccentColor}
        fontFamily={localFontFamily}
        layout={localLayout}
      />

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Brand Colors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="brandColor">Brand / Primary color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="brandColor"
                  type="color"
                  value={localBrandColor}
                  onChange={(e) => setLocalBrandColor(e.target.value)}
                  className="w-12 h-8 p-0"
                />
                <Input
                  value={localBrandColor}
                  onChange={(e) => setLocalBrandColor(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="accentColor">Accent color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="accentColor"
                  type="color"
                  value={localAccentColor}
                  onChange={(e) => setLocalAccentColor(e.target.value)}
                  className="w-12 h-8 p-0"
                />
                <Input
                  value={localAccentColor}
                  onChange={(e) => setLocalAccentColor(e.target.value)}
                />
              </div>
            </div>
          </div>
          <Button onClick={saveColors} disabled={saving === "colors"}>
            {saving === "colors" ? "Saving…" : "Save colors"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="fontFamily">Font family</Label>
            <Select value={localFontFamily || ""} onValueChange={setLocalFontFamily}>
              <SelectTrigger id="fontFamily">
                <SelectValue placeholder="Select a font" />
              </SelectTrigger>
              <SelectContent>
                {fonts.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={saveFont} disabled={saving === "font"}>
            {saving === "font" ? "Saving…" : "Save font"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Layout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="layout">Page layout</Label>
            <Select value={localLayout} onValueChange={setLocalLayout}>
              <SelectTrigger id="layout">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {layouts.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={saveLayout} disabled={saving === "layout"}>
            {saving === "layout" ? "Saving…" : "Save layout"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
