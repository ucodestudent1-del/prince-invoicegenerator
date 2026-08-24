"use client";

import * as React from "react";
import { Link, useRouter } from "@/i18n/navigation";
import Image from "next/image";
import { createInvoice } from "@/lib/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { CatalogItemSelector } from "@/components/catalog-item-selector";
import { UnbilledTimeSelector } from "@/components/unbilled-time-selector";
import { Clock } from "lucide-react";

export function InvoiceForm({
  customers,
  projects,
  canRetainage,
  canProgress,
  canRecurring,
  canCustomizeInvoiceNumber,
  canProjectManagement,
  canSchedule,
  hasSavedAddresses,
  canUseCatalog,
  canUseTimeTracking,
}: {
  customers: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  canRetainage: boolean;
  canProgress: boolean;
  canRecurring: boolean;
  canCustomizeInvoiceNumber: boolean;
  canProjectManagement: boolean;
  canSchedule: boolean;
  hasSavedAddresses: boolean;
  canUseCatalog: boolean;
  canUseTimeTracking: boolean;
}) {
  const t = useTranslations("invoices");
  const router = useRouter();
  const [error, setError] = React["useState"]<string | null>(null);
  const [saving, setSaving] = React["useState"](false);
  const [customerId, setCustomerId] = React["useState"]("");
  const [projectId, setProjectId] = React["useState"]("");
  const [type, setType] = React["useState"]<"STANDARD" | "PROGRESS" | "RECURRING">("STANDARD");
  const [issueDate, setIssueDate] = React["useState"](
    new Date()["toISOString"]()["slice"](0, 10)
  );
  const [dueDate, setDueDate] = React["useState"]("");
  const [scheduledFor, setScheduledFor] = React["useState"]("");
  const [taxRate, setTaxRate] = React["useState"]<string | number>(0);
  const [discount, setDiscount] = React["useState"]<string | number>(0);
  const [retainageRate, setRetainageRate] = React["useState"]<string | number>(0);
  const [invoiceNumber, setInvoiceNumber] = React["useState"]("");
  const [notes, setNotes] = React["useState"]("");
  const [logoUrl, setLogoUrl] = React["useState"]<string | null>(null);
  const [logoFile, setLogoFile] = React["useState"]<File | null>(null);
  const [logoPreview, setLogoPreview] = React["useState"]<string | null>(null);
  const [billToAddress, setBillToAddress] = React["useState"]("");
  const [shipToAddress, setShipToAddress] = React["useState"]("");
  const [items, setItems] = React["useState"]([
    { description: "", quantity: 1, unitPrice: 0, sku: "" },
  ]);
  const [trackedTime, setTrackedTime] = React["useState"]<any[] | null>(null);

  const handleAddTrackedTime = (entries: any[]) => {
    entries["forEach"]((entry) => {
      const hours = entry["duration"] / 3600;
      setItems((prev) => [
        ...prev,
        {
          description: entry["description"] || `${entry["project"]?.["name"] || "Project"} - ${formatDuration(entry["duration"])}`,
          quantity: hours,
          unitPrice: entry["hourlyRate"],
          sku: "",
        },
      ]);
    });
  };

  function formatDuration(seconds: number) {
    const h = Math["floor"](seconds / 3600);
    const m = Math["floor"]((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }

  async function loadTrackedTime() {
    try {
      const res = await fetch("/api/time-tracking/entries?action=for-invoice");
      if (res["ok"]) {
        const data = await res["json"]();
        setTrackedTime(data);
      }
    } catch (err) {
      console["error"]("Failed to load tracked time:", err);
    }
  }

  const subtotal = items["reduce"]((a, i) => a + i["quantity"] * (Number(i["unitPrice"]) || 0), 0);
  const taxAmount = ((subtotal * (Number(taxRate) || 0)) / 100);
  const total = subtotal + taxAmount - (Number(discount) || 0);
  const retainageAmount = canRetainage ? ((total * (Number(retainageRate) || 0)) / 100) : 0;

  function updateItem(idx: number, field: string, value: any) {
    setItems((prev) =>
      prev["map"]((it, i) => (i === idx ? { ...it, [field]: value } : it))
    );
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e["target"]["files"]?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"]["includes"](file["type"])) {
      setError("Invalid file type. Accepted: PNG, JPG, WebP");
      return;
    }
    if (file["size"] > 5 * 1024 * 1024) {
      setError("File too large. Maximum 5MB");
      return;
    }
    setError(null);
    setLogoFile(file);
    const reader = new FileReader();
    reader["onloadend"] = () => {
      setLogoPreview(reader["result"] as string);
    };
    reader["readAsDataURL"](file);
  }

  async function uploadLogo(file: File): Promise<string | null> {
    const form = new FormData();
    form["append"]("file", file);
    const res = await fetch("/api/invoices/upload-logo", {
      method: "POST",
      body: form,
    });
    if (!res["ok"]) {
      const data = await res["json"]();
      throw new Error(data["error"] ?? "Logo upload failed");
    }
    const data = await res["json"]();
    return data["url"] as string;
  }

  async function handleSubmit(e: React.FormEvent) {
    e["preventDefault"]();
    setError(null);
    if (!customerId) {
      setError("Please select a customer.");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      let uploadedLogoUrl: string | null = null;
      if (logoFile) {
        try {
          uploadedLogoUrl = await uploadLogo(logoFile);
        } catch (logoErr) {
          console["error"]("Logo upload failed, continuing without logo:", logoErr);
        }
      }
        const invoice = await createInvoice({
          customerId,
          projectId: projectId || null,
          type,
          issueDate,
          dueDate: dueDate || null,
          taxRate: Number(taxRate) || 0,
          discount: Number(discount) || 0,
          retainageRate: canRetainage ? Number(retainageRate) || 0 : 0,
          notes,
          invoiceNumber: canCustomizeInvoiceNumber ? invoiceNumber || null : null,
          logoUrl: uploadedLogoUrl ?? logoUrl ?? null,
          billToAddress: billToAddress || null,
          shipToAddress: shipToAddress || null,
          scheduledFor: scheduledFor || null,
          items: items
            ["filter"]((i) => i["description"])
            ["map"]((i) => ({
              description: i["description"],
              quantity: Number(i["quantity"]) || 0,
              unitPrice: Number(i["unitPrice"]) || 0,
              sku: i["sku"] || null,
            })),
        });
        if (!invoice?.["id"]) {
          throw new Error("Failed to create invoice. Please try again.");
        }
        window["open"](`/dashboard/invoices/${invoice["id"]}/print?auto`, "_blank");
        router["push"](`/dashboard/invoices/${invoice["id"]}`);
    } catch (err: any) {
      setError(err?.["message"] ?? "Failed to create invoice.");
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
            {customers["length"] === 0 ? (
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
                name="customer"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={customerId}
                onChange={(e) => setCustomerId(e["target"]["value"])}
                required
              >
                <option value="">Select a customer…</option>
                {customers["map"]((c) => (
                  <option key={c["id"]} value={c["id"]}>
                    {c["name"]}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1" hidden={!canProjectManagement}>
            <Label htmlFor="project">Project</Label>
            {projects["length"] === 0 ? (
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
                name="project"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e["target"]["value"])}
              >
                <option value="">None</option>
                {projects["map"]((p) => (
                  <option key={p["id"]} value={p["id"]}>
                    {p["name"]}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={type}
              onChange={(e) => setType(e["target"]["value"] as "STANDARD" | "PROGRESS" | "RECURRING")}
            >
              <option value="STANDARD">{t("standard")}</option>
              {canProgress && <option value="PROGRESS">{t("progress")}</option>}
              {canRecurring && <option value="RECURRING">{t("recurring")}</option>}
            </select>
          </div>
          {canCustomizeInvoiceNumber && (
            <div className="space-y-1">
              <Label htmlFor="invoiceNumber">Invoice name / number</Label>
              <Input
                id="invoiceNumber"
                placeholder="e.g. INV-001 or custom name"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e["target"]["value"])}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="issue">Issue date</Label>
            <Input
              id="issue"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e["target"]["value"])}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="due">Due date</Label>
            <Input
              id="due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e["target"]["value"])}
            />
          </div>
          <div className="space-y-1" hidden={!canSchedule}>
            <Label htmlFor="scheduledFor">Schedule for later</Label>
            <Input
              id="scheduledFor"
              type="date"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              min={issueDate}
            />
            {scheduledFor && (
              <p className="text-xs text-muted-foreground">
                This invoice will be scheduled for {scheduledFor}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Leave empty to create the invoice immediately. When set, the
              invoice will be saved as a draft and automatically marked as SENT
              on the scheduled date.
            </p>
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
              <Image src={logoPreview} alt="Logo preview" width={64} height={64} className="mt-2 h-16 w-auto object-contain" />
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
              onChange={(e) => setBillToAddress(e["target"]["value"])}
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="shipTo">Ship To (optional)</Label>
            <Textarea
              id="shipTo"
              placeholder="Address line 1&#10;City, State ZIP"
              value={shipToAddress}
              onChange={(e) => setShipToAddress(e["target"]["value"])}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
          <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Line items</CardTitle>
          <div className="flex gap-2">
            {canUseTimeTracking && (
              <UnbilledTimeSelector
                entries={trackedTime || []}
                onSelect={handleAddTrackedTime}
                trigger={
                  <Button type="button" variant="outline" size="sm" onClick={loadTrackedTime}>
                    <Clock className="h-4 w-4 mr-1" />
                    Add Tracked Time
                  </Button>
                }
              />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setItems((p) => [...p, { description: "", quantity: 1, unitPrice: 0, sku: "" }])
              }
            >
              Add item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items["map"]((it, idx) => (
            <div key={idx} className="flex gap-2 items-end">
              {canUseCatalog && (
                <CatalogItemSelector
                  onSelect={(item) => {
                    updateItem(idx, "description", item["name"]);
                    updateItem(idx, "unitPrice", item["price"]);
                    updateItem(idx, "sku", item["sku"] || "");
                    if (item["taxRate"] > 0) {
                      setTaxRate(item["taxRate"]);
                    }
                  }}
                  trigger={<Button type="button" variant="outline" size="sm">Browse</Button>}
                />
              )}
              <Input
                placeholder="Description"
                value={it["description"]}
                onChange={(e) => updateItem(idx, "description", e["target"]["value"])}
                className="flex-1"
              />
              <Input
                type="number"
                className="w-20"
                value={it["quantity"]}
                min={0}
                onChange={(e) => updateItem(idx, "quantity", e["target"]["value"] === "" ? "" : Number(e["target"]["value"]))}
              />
              <Input
                type="number"
                className="w-28"
                value={it["unitPrice"]}
                min={0}
                step="0.01"
                onChange={(e) => updateItem(idx, "unitPrice", e["target"]["value"] === "" ? "" : Number(e["target"]["value"]))}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setItems((p) => p["filter"]((_, i) => i !== idx))}
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
                step="0.01"
                value={taxRate}
                min={0}
                onChange={(e) => setTaxRate(e["target"]["value"] === "" ? "" : Number(e["target"]["value"]))}
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
                onChange={(e) => setDiscount(e["target"]["value"] === "" ? "" : Number(e["target"]["value"]))}
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
                  onChange={(e) => setRetainageRate(e["target"]["value"] === "" ? "" : Number(e["target"]["value"]))}
                />
              </div>
            )}
          </div>

          <Textarea
            placeholder="Notes (payment terms, job reference, etc.)"
            value={notes}
            onChange={(e) => setNotes(e["target"]["value"])}
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
            {saving ? "Saving…" : scheduledFor ? "Schedule Invoice" : "Create Invoice"}
          </Button>
        </div>
    </form>
  );
}

