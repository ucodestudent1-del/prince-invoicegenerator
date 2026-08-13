"use client";

import * as React from "react";
import { Link, useRouter, getPathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { createRecurringConfig } from "@/lib/actions/recurring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RecurringConfigForm({
  customers,
  projects,
}: {
  customers: { id: string; name: string }[];
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const locale = useLocale();
  const [customerId, setCustomerId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [frequency, setFrequency] = React.useState("MONTHLY");
  const [startDate, setStartDate] = React.useState(
    new Date().toISOString().slice(0, 10)
  );
  const [taxRate, setTaxRate] = React.useState<string | number>(0);
  const [discount, setDiscount] = React.useState<string | number>(0);
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  function updateItem(idx: number, field: string, value: any) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!customerId) {
      setError("Customer is required.");
      return;
    }
    setSaving(true);
    try {
      await createRecurringConfig({
        customerId,
        projectId: projectId || null,
        frequency,
        startDate,
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
      router.push(getPathname({ href: "/dashboard/recurring", locale }));
    } catch (err: any) {
      setError(err?.message ?? "Failed to create recurring config.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
             <Label htmlFor="customer">Customer</Label>
             {customers.length === 0 ? (
               <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                 No customers found.{" "}
                 <Link
                   href="/dashboard/customers/new"
                   className="text-primary underline"
                 >
                   Create one first.
                 </Link>
               </div>
             ) : (
               <select
                 id="customer"
                 className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                 value={customerId}
                 onChange={(e) => setCustomerId(e.target.value)}
                 required
               >
                 <option value="">Select a customer…</option>
                 {customers.map((c) => (
                   <option key={c.id} value={c.id}>
                     {c.name}
                   </option>
                 ))}
               </select>
             )}
           </div>
           <div className="space-y-1">
             <Label htmlFor="project">Project</Label>
            {projects.length === 0 ? (
              <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                No projects found.{" "}
                <Link
                  href="/dashboard/projects/new"
                  className="text-primary underline"
                >
                  Create one first.
                </Link>
              </div>
            ) : (
              <select
                id="project"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="frequency">Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger id="frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="BIWEEKLY">Bi-weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                <SelectItem value="SEMIANNUAL">Semi-annually</SelectItem>
                <SelectItem value="ANNUAL">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="taxRate">Tax rate %</Label>
            <Input
              id="taxRate"
              type="number"
              step="0.01"
              value={taxRate}
              min={0}
              onChange={(e) => setTaxRate(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="discount">Discount</Label>
            <Input
              id="discount"
              type="number"
              value={discount}
              min={0}
              step="0.01"
              onChange={(e) => setDiscount(e.target.value === "" ? "" : Number(e.target.value))}
            />
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
            onClick={() =>
              setItems((p) => [...p, { description: "", quantity: 1, unitPrice: 0 }])
            }
          >
            Add item
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                placeholder="Description"
                value={it.description}
                onChange={(e) => updateItem(idx, "description", e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                className="w-20"
                value={it.quantity}
                min={0}
                onChange={(e) => updateItem(idx, "quantity", e.target.value === "" ? "" : Number(e.target.value))}
              />
              <Input
                type="number"
                className="w-28"
                value={it.unitPrice}
                min={0}
                step="0.01"
                onChange={(e) => updateItem(idx, "unitPrice", e.target.value === "" ? "" : Number(e.target.value))}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
              >
                &times;
              </Button>
            </div>
          ))}
          <Textarea
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push(getPathname({ href: "/dashboard/recurring", locale }))}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Create recurring config"}
        </Button>
      </div>
    </form>
  );
}

