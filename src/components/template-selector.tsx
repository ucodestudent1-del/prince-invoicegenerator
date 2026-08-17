"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

const templates = [
  { value: "REGULAR_INVOICE", label: "Regular Invoice", description: "Standard business invoice with full details." },
  { value: "TAX_INVOICE", label: "Tax Invoice", description: "Includes tax IDs and emphasized tax breakdown." },
  { value: "PROFORMA_INVOICE", label: "Proforma Invoice", description: "Preliminary/quotation-style with estimated totals." },
  { value: "RECEIPT", label: "Receipt", description: "Compact payment confirmation with PAID indicator." },
];

export function TemplateSelector({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {templates.map((t) => {
        const isActive = selected === t.value;
        return (
          <Card
            key={t.value}
            className={`cursor-pointer border-2 transition-all ${
              isActive ? "border-primary" : "border-muted"
            }`}
            onClick={() => onChange(t.value)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                {t.label}
                {isActive && <Check className="h-4 w-4 text-primary" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function TemplateSelectorForm({ current, onSaved, onTemplateChange }: {
  current: string;
  onSaved?: () => void;
  onTemplateChange?: (value: string) => void;
}) {
  const [selected, setSelected] = React.useState(current);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/customization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "template", value: selected }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save template.");
      }
      setSuccess(true);
      onSaved?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleChange(value: string) {
    setSelected(value);
    setSuccess(false);
    onTemplateChange?.(value);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700">
          Template saved successfully.
        </div>
      )}
      <TemplateSelector selected={selected} onChange={handleChange} />
      <Button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save template"}
      </Button>
    </div>
  );
}
