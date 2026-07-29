"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createEstimate } from "@/lib/actions/features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function EstimateForm({ customers }: { customers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [customerId, setCustomerId] = React.useState("");
  const [validUntil, setValidUntil] = React.useState("");
  const [taxRate, setTaxRate] = React.useState<string | number>(0);
  const [discount, setDiscount] = React.useState<string | number>(0);
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState([{ description: "", quantity: 1, unitPrice: 0 }]);

  const subtotal = items.reduce((a, i) => a + i.quantity * (Number(i.unitPrice) || 0), 0);
  const taxAmount = ((subtotal * (Number(taxRate) || 0)) / 100);
  const total = subtotal + taxAmount - (Number(discount) || 0);

  function updateItem(idx: number, field: string, value: any) {
    setItems((p) => p.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!customerId) return setError("Select a customer.");
    setSaving(true);
    try {
      await createEstimate({
        customerId,
        validUntil: validUntil || null,
        taxRate: Number(taxRate) || 0,
        discount: Number(discount) || 0,
        notes,
        items: items
          .filter((i) => i.description)
          .map((i) => ({
            description: i.description,
            quantity: Number(i.quantity) || 0,
            unitPrice: Number(i.unitPrice) || 0,
          })),
      });
      router.push("/dashboard/estimates");
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Failed.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Customer</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Valid until</Label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Line items</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((p) => [...p, { description: "", quantity: 1, unitPrice: 0 }])}
          >
            Add item
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                placeholder="Description"
                className="flex-1"
                value={it.description}
                onChange={(e) => updateItem(idx, "description", e.target.value)}
              />
              <Input
                type="number"
                className="w-20"
                value={it.quantity}
                onChange={(e) => updateItem(idx, "quantity", e.target.value === "" ? "" : Number(e.target.value))}
              />
              <Input
                type="number"
                className="w-28"
                step="0.01"
                value={it.unitPrice}
                onChange={(e) => updateItem(idx, "unitPrice", e.target.value === "" ? "" : Number(e.target.value))}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
              >
                ✕
              </Button>
            </div>
          ))}
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Tax rate %</Label>
              <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Discount</Label>
              <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          </div>
          <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex justify-end gap-6 text-sm">
            <div>Subtotal: <strong>{formatCurrency(subtotal)}</strong></div>
            <div>Tax: <strong>{formatCurrency(taxAmount)}</strong></div>
            <div>Total: <strong className="text-base">{formatCurrency(total)}</strong></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Create estimate"}
        </Button>
      </div>
    </form>
  );
}
