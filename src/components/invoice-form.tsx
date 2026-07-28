"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createInvoice } from "@/lib/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
}
interface Project {
  id: string;
  name: string;
}

export function InvoiceForm({
  customers,
  projects,
  canRetainage,
  canProgress,
  canRecurring,
  canCustomizeInvoiceNumber,
}: {
  customers: Customer[];
  projects: Project[];
  canRetainage: boolean;
  canProgress: boolean;
  canRecurring: boolean;
  canCustomizeInvoiceNumber: boolean;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [customerId, setCustomerId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [type, setType] = React.useState("STANDARD");
  const [issueDate, setIssueDate] = React.useState(
    new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = React.useState("");
  const [taxRate, setTaxRate] = React.useState(0);
  const [discount, setDiscount] = React.useState(0);
  const [retainageRate, setRetainageRate] = React.useState(0);
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);

  const subtotal = items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount - discount;
  const retainageAmount = canRetainage ? (total * retainageRate) / 100 : 0;

  function updateItem(idx: number, field: string, value: any) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!customerId) {
      setError("Please select a customer.");
      return;
    }
    setSaving(true);
    try {
      const invoice = await createInvoice({
        customerId,
        projectId: projectId || null,
        type: canProgress ? (type as any) : "STANDARD",
        issueDate,
        dueDate: dueDate || null,
        taxRate,
        discount,
        retainageRate: canRetainage ? retainageRate : 0,
        notes,
        invoiceNumber: canCustomizeInvoiceNumber ? invoiceNumber || null : null,
        items: items.filter((i) => i.description),
      });
      router.push(`/dashboard/invoices/${invoice.id}`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create invoice.");
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
            <select
              id="customer"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select customer&#x2026;</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company ? `${c.name} (${c.company})` : c.name}
                  {c.email ? ` &#x2014; ${c.email}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="project">Project</Label>
            <select
              id="project"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={projects.length === 0}
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {canProgress && (
            <div className="space-y-1">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="STANDARD">Standard</option>
                <option value="PROGRESS">Progress (AIA-style)</option>
                {canRecurring && <option value="RECURRING">Recurring</option>}
              </select>
            </div>
          )}
          {canCustomizeInvoiceNumber && (
            <div className="space-y-1">
              <Label htmlFor="invoiceNumber">Invoice name / number</Label>
              <Input
                id="invoiceNumber"
                placeholder="e.g. INV-001 or custom name"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="issue">Issue date</Label>
            <Input
              id="issue"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="due">Due date</Label>
            <Input
              id="due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
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
                onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
              />
              <Input
                type="number"
                className="w-28"
                value={it.unitPrice}
                min={0}
                step="0.01"
                onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
              >
                &#x2715;
              </Button>
            </div>
          ))}

          <div className="grid gap-4 pt-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="tax">Tax rate %</Label>
              <Input
                id="tax"
                type="number"
                value={taxRate}
                min={0}
                onChange={(e) => setTaxRate(Number(e.target.value))}
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
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>
            {canRetainage && (
              <div className="space-y-1">
                <Label htmlFor="retainage">Retainage %</Label>
                <Input
                  id="retainage"
                  type="number"
                  value={retainageRate}
                  min={0}
                  onChange={(e) => setRetainageRate(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          <Textarea
            placeholder="Notes (payment terms, job reference, etc.)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex justify-end gap-6 text-sm">
            <div>
              Subtotal: <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <div>
              Tax: <strong>{formatCurrency(taxAmount)}</strong>
            </div>
            {canRetainage && (
              <div>
                Retainage: <strong>{formatCurrency(retainageAmount)}</strong>
              </div>
            )}
            <div>
              Total: <strong className="text-base">{formatCurrency(total)}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving&#x2026;" : "Create invoice"}
        </Button>
      </div>
    </form>
  );
}