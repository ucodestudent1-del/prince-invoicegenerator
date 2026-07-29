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

export function InvoiceForm({
  canRetainage,
  canProgress,
  canRecurring,
  canCustomizeInvoiceNumber,
  canProjectManagement,
}: {
  canRetainage: boolean;
  canProgress: boolean;
  canRecurring: boolean;
  canCustomizeInvoiceNumber: boolean;
  canProjectManagement: boolean;
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
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [billToAddress, setBillToAddress] = React.useState("");
  const [shipToAddress, setShipToAddress] = React.useState("");
  const [customerSearch, setCustomerSearch] = React.useState("");
  const [projectSearch, setProjectSearch] = React.useState("");
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

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      setError("Invalid file type. Accepted: PNG, JPG, WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large. Maximum 5MB");
      return;
    }
    setError(null);
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function uploadLogo(file: File): Promise<string | null> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/invoices/upload-logo", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Logo upload failed");
    }
    const data = await res.json();
    return data.url as string;
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
      let uploadedLogoUrl: string | null = null;
      if (logoFile) {
        uploadedLogoUrl = await uploadLogo(logoFile);
      }
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
        logoUrl: uploadedLogoUrl ?? logoUrl ?? null,
        billToAddress: billToAddress || null,
        shipToAddress: shipToAddress || null,
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
            <Input
              id="customer"
              name="customer"
              placeholder="Enter customer name"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="project">Project</Label>
            <Input
              id="project"
              name="project"
              placeholder="Enter project name"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              hidden={!canProjectManagement}
            />
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
          <div className="space-y-1">
            <Label htmlFor="logo">Logo</Label>
            <Input
              id="logo"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleLogoChange}
            />
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Logo preview"
                className="mt-2 h-16 object-contain"
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bill &amp; Ship To</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="billTo">Bill To (optional)</Label>
            <Textarea
              id="billTo"
              placeholder="Address line 1&#10;City, State ZIP"
              value={billToAddress}
              onChange={(e) => setBillToAddress(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="shipTo">Ship To (optional)</Label>
            <Textarea
              id="shipTo"
              placeholder="Address line 1&#10;City, State ZIP"
              value={shipToAddress}
              onChange={(e) => setShipToAddress(e.target.value)}
              rows={3}
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
