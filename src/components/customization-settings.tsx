"use client";

import * as React from "react";
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

export function CustomizationSettings() {
  const [brandColor, setBrandColor] = React.useState("#ea5804");
  const [accentColor, setAccentColor] = React.useState("#ea5804");
  const [fontFamily, setFontFamily] = React.useState("");
  const [layout, setLayout] = React.useState("default");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const [colorsRes, fontsRes, layoutRes] = await Promise.all([
          fetch("/api/customization?key=colors"),
          fetch("/api/customization?key=fonts"),
          fetch("/api/customization?key=layout"),
        ]);
        if (colorsRes.ok) {
          const data = await colorsRes.json();
          setBrandColor(data.brandColor || "#ea5804");
          setAccentColor(data.accentColor || "#ea580ade");
        }
        if (fontsRes.ok) {
          const data = await fontsRes.json();
          setFontFamily(data || "");
        }
        if (layoutRes.ok) {
          const data = await layoutRes.json();
          setLayout(data || "default");
        }
      } catch (err) {
        console.error("Failed to load customization", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function saveColors() {
    await fetch("/api/customization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "colors",
        brandColor,
        accentColor,
      }),
    });
  }

  async function saveFont() {
    await fetch("/api/customization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "fonts", value: fontFamily }),
    });
  }

  async function saveLayout() {
    await fetch("/api/customization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "layout", value: layout }),
    });
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading customization settings…</p>;

  return (
    <div className="space-y-6">
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
                  value={brandColor || "#ea580ade"}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-12 h-8 p-0"
                />
                <Input
                  value={brandColor || "#ea580ade"}
                  onChange={(e) => setBrandColor(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="accentColor">Accent color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="accentColor"
                  type="color"
                  value={accentColor || "#ea580ade"}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-12 h-8 p-0"
                />
                <Input
                  value={accentColor || "#ea580ade"}
                  onChange={(e) => setAccentColor(e.target.value)}
                />
              </div>
            </div>
          </div>
          <Button onClick={saveColors}>Save colors</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="fontFamily">Font family</Label>
            <Select value={fontFamily || ""} onValueChange={setFontFamily}>
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
          <Button onClick={saveFont}>Save font          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Layout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="layout">Page layout</Label>
            <Select value={layout} onValueChange={setLayout}>
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
          <Button onClick={saveLayout}>Save layout</Button>
        </CardContent>
      </Card>
    </div>
  );
}
