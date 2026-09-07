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
import {
  getInvoiceTemplate,
  getAvailableInvoiceTypes,
  type InvoiceTemplateConfig,
} from "@/lib/invoice-templates";
import type { InvoiceType } from "@prisma/client";
import { Clock, ChevronDown } from "lucide-react";

export function InvoiceForm({
  customers,
  projects,
  canRetainage,
  canProgress,
  canRecurring,
  canCustomizeInvoiceNumber,
  canProjectManagement,
  hasSavedAddresses,
  canUseCatalog,
  canUseTimeTracking,
  preselectedProject,
  projectFinancials,
}: {
  customers: { id: string; name: string }[];
  projects: { id: string; name: string; customerId?: string | null; contractValue?: number | null; estimatedCost?: number | null; taxRate?: number | null; paymentTerms?: string | null }[];
  canRetainage: boolean;
  canProgress: boolean;
  canRecurring: boolean;
  canCustomizeInvoiceNumber: boolean;
  canProjectManagement: boolean;
  hasSavedAddresses: boolean;
  canUseCatalog: boolean;
  canUseTimeTracking: boolean;
  preselectedProject?: {
    id: string;
    name: string;
    customerId: string | null;
    contractValue: number;
    estimatedCost: number;
    taxRate: number;
    paymentTerms: string;
  } | null;
  projectFinancials?: {
    currentContractValue: number;
    totalInvoiced: number;
    remainingBillable: number;
    outstandingBalance: number;
    currency: string;
  } | null;
}) {
  const t = useTranslations("invoices");
  const tProjects = useTranslations("projects");
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [customerId, setCustomerId] = React.useState(preselectedProject?.["customerId"] ?? "");
  const [projectId, setProjectId] = React.useState(preselectedProject?.["id"] ?? "");
  const [billingIntent, setBillingIntent] = React.useState<"DEPOSIT" | "PROGRESS" | "FINAL" | "CUSTOM">(
    preselectedProject ? "PROGRESS" : "CUSTOM",
  );
  const [type, setType] = React.useState<InvoiceType>("STANDARD");
  const [issueDate, setIssueDate] = React.useState(new Date()["toISOString"]()["slice"](0, 10));
  const [dueDate, setDueDate] = React.useState("");
  const [taxRate, setTaxRate] = React.useState<string | number>(preselectedProject?.["taxRate"] ?? 0);
  const [discount, setDiscount] = React.useState<string | number>(0);
  const [retainageRate, setRetainageRate] = React.useState<string | number>(0);
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [billToAddress, setBillToAddress] = React.useState("");
  const [shipToAddress, setShipToAddress] = React.useState("");
  const [items, setItems] = React.useState([
    { description: "", quantity: 1, unitPrice: 0, sku: "" },
  ]);
  const [trackedTime, setTrackedTime] = React.useState<any[] | null>(null);

  const availableTypes = getAvailableInvoiceTypes(canProgress, canRecurring, canRetainage);
  const template: InvoiceTemplateConfig = getInvoiceTemplate(type);

  React.useEffect(() => {
    const defaults = getInvoiceTemplate(type).defaults;
    setTaxRate(defaults.taxRate);
    setDiscount(defaults.discount);
    setRetainageRate(defaults.retainageRate);
    if (defaults.billingIntent) {
      setBillingIntent(defaults.billingIntent);
    }
  }, [type]);

  function onProjectChange(newProjectId: string) {
    setProjectId(newProjectId);
    const proj = projects.find((p) => p.id === newProjectId);
    if (proj?.["customerId"] && !customerId) {
      setCustomerId(proj["customerId"]);
    }
    if (proj && typeof proj["taxRate"] === "number") {
      setTaxRate(proj["taxRate"]);
    }
  }

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
  const totalBeforeRetainage = subtotal + taxAmount - (Number(discount) || 0);
  const retainageAmount = canRetainage && template.features.supportsRetainage ? ((totalBeforeRetainage * (Number(retainageRate) || 0)) / 100) : 0;
  const total = totalBeforeRetainage - retainageAmount;

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
    if (projectId && projectFinancials && subtotal > projectFinancials.remainingBillable + 0.01) {
      setError(
        `This invoice total (${subtotal.toFixed(2)}) exceeds the remaining contract balance (${projectFinancials.remainingBillable.toFixed(2)}). Please reduce the amount or remove the project.`,
      );
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
      const intentPrefix =
        projectId && billingIntent !== "CUSTOM"
          ? `[${billingIntent}] `
          : "";
      const invoice = await createInvoice({
        customerId,
        projectId: projectId || null,
        type,
        issueDate,
        dueDate: dueDate || null,
        taxRate: Number(taxRate) || 0,
        discount: Number(discount) || 0,
        retainageRate: canRetainage && template.features.supportsRetainage ? Number(retainageRate) || 0 : 0,
        notes: intentPrefix + (notes ?? ""),
        invoiceNumber: canCustomizeInvoiceNumber ? invoiceNumber || null : null,
        logoUrl: uploadedLogoUrl ?? logoUrl ?? null,
        billToAddress: billToAddress || null,
        shipToAddress: shipToAddress || null,
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
          <CardTitle className="text-lg">{t("details")}</CardTitle>
          <p className="text-sm text-muted-foreground">{template.description}</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="customer">{t("selectCustomer")}</Label>
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
            <Label htmlFor="project">{t("selectProject")}</Label>
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
                onChange={(e) => onProjectChange(e["target"]["value"])}
              >
                <option value="">None</option>
                {projects["map"]((p) => (
                  <option key={p["id"]} value={p["id"]}>
                    {p["name"]}
                  </option>
                ))}
              </select>
            )}
            {projectId && projectFinancials && (
              <div className="mt-2 rounded-md border border-blue-200 bg-blue-50/40 p-3 text-xs space-y-1">
                <div className="font-medium text-blue-900">{tProjects("projectFinancials")}</div>
                <div className="grid grid-cols-2 gap-1 text-blue-800">
                  <div>{tProjects("currentContractValue")}: <span className="font-semibold">{formatCurrency(projectFinancials.currentContractValue)}</span></div>
                  <div>{tProjects("totalInvoiced")}: <span className="font-semibold">{formatCurrency(projectFinancials.totalInvoiced)}</span></div>
                  <div className="col-span-2">{tProjects("remainingBillable")}: <span className="font-semibold">{formatCurrency(projectFinancials.remainingBillable)}</span></div>
                </div>
                {subtotal > projectFinancials.remainingBillable + 0.01 && (
                  <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-red-800">
                    {tProjects("overbilledWarning", {
                      attempted: formatCurrency(subtotal),
                      available: formatCurrency(projectFinancials.remainingBillable),
                    })}
                  </div>
                )}
              </div>
            )}
            {projectId && template.features.requiresProject && (
              <div className="mt-2 space-y-1">
                <Label htmlFor="billingIntent">{tProjects("billingIntent")}</Label>
                <select
                  id="billingIntent"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={billingIntent}
                  onChange={(e) => setBillingIntent(e["target"]["value"] as "DEPOSIT" | "PROGRESS" | "FINAL" | "CUSTOM")}
                >
                  <option value="DEPOSIT">{tProjects("billingIntentDeposit")}</option>
                  <option value="PROGRESS">{tProjects("billingIntentProgress")}</option>
                  <option value="FINAL">{tProjects("billingIntentFinal")}</option>
                  <option value="CUSTOM">{tProjects("billingIntentCustom")}</option>
                </select>
                {billingIntent === "FINAL" && template.suggestions.fillRemaining && items.length === 1 && items[0]["description"] === "" && projectFinancials && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={() => {
                      const remaining = projectFinancials.remainingBillable;
                      setItems([{ description: "Final invoice — remaining contract balance", quantity: 1, unitPrice: Math.max(0, remaining), sku: "" }]);
                    }}
                  >
                    {tProjects("fillRemaining")}
                  </Button>
                )}
                {billingIntent === "DEPOSIT" && template.suggestions.depositPercent && items.length === 1 && items[0]["description"] === "" && projectFinancials && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={() => {
                      const depositAmt = Math.round(projectFinancials.currentContractValue * (template.suggestions.depositPercent ?? 10) / 100 * 100) / 100;
                      setItems([{ description: `Project deposit (${template.suggestions.depositPercent ?? 10}%)`, quantity: 1, unitPrice: depositAmt, sku: "" }]);
                    }}
                  >
                    {tProjects("suggestDeposit")}
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="type">{t("type")}</Label>
            <div className="relative">
              <select
                id="type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm appearance-none"
                value={type}
                onChange={(e) => setType(e["target"]["value"] as InvoiceType)}
              >
                {availableTypes.map((tp) => (
                  <option key={tp} value={tp}>
                    {getInvoiceTemplate(tp).label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          {canCustomizeInvoiceNumber && (
            <div className="space-y-1">
              <Label htmlFor="invoiceNumber">{t("invoiceName")}</Label>
              <Input
                id="invoiceNumber"
                placeholder={t("invoiceNamePlaceholder")}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e["target"]["value"])}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="issue">{t("issueDate")}</Label>
            <Input
              id="issue"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e["target"]["value"])}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="due">{t("dueDateLabel")}</Label>
            <Input
              id="due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e["target"]["value"])}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="logo">{t("logo")}</Label>
            <Input
              id="logo"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleLogoChange}
            />
            {logoPreview && (
              <Image src={logoPreview} alt="Logo preview" width={64} height={64} sizes="64px" className="mt-2 h-16 w-auto object-contain" />
            )}
          </div>
        </CardContent>
      </Card>

      {template.sections.billTo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("billToLabel")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="billTo">{t("billToLabel")}</Label>
              <Textarea
                id="billTo"
                placeholder={t("addressPlaceholder")}
                value={billToAddress}
                onChange={(e) => setBillToAddress(e["target"]["value"])}
                rows={3}
              />
            </div>
            {template.sections.shipTo && (
              <div className="space-y-1">
                <Label htmlFor="shipTo">{t("shipToLabel")}</Label>
                <Textarea
                  id="shipTo"
                  placeholder={t("addressPlaceholder")}
                  value={shipToAddress}
                  onChange={(e) => setShipToAddress(e["target"]["value"])}
                  rows={3}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {template.sections.lineItems && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{t("lineItems")}</CardTitle>
            <div className="flex gap-2">
              {canUseTimeTracking && template.features.supportsTimeTracking && (
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
                {canUseCatalog && template.features.supportsCatalog && (
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
                  placeholder={t("description")}
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
              {template.sections.tax && (
                <div className="space-y-1">
                  <Label htmlFor="tax">{t("taxRate")}</Label>
                  <Input
                    id="tax"
                    type="number"
                    step="0.01"
                    value={taxRate}
                    min={0}
                    onChange={(e) => setTaxRate(e["target"]["value"] === "" ? "" : Number(e["target"]["value"]))}
                  />
                </div>
              )}
              {template.sections.discount && (
                <div className="space-y-1">
                  <Label htmlFor="discount">{t("discount")}</Label>
                  <Input
                    id="discount"
                    type="number"
                    value={discount}
                    min={0}
                    step="0.01"
                    onChange={(e) => setDiscount(e["target"]["value"] === "" ? "" : Number(e["target"]["value"]))}
                  />
                </div>
              )}
              {template.sections.retainage && canRetainage && template.features.supportsRetainage && (
                <div className="space-y-1">
                  <Label htmlFor="retainage">{t("retainagePercent")}</Label>
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

            {template.sections.notes && (
              <Textarea
                placeholder="Notes (payment terms, job reference, etc.)"
                value={notes}
                onChange={(e) => setNotes(e["target"]["value"])}
              />
            )}

            <div className="flex justify-end gap-6 text-sm">
              <div>
                {t("subtotal")}: <strong>{formatCurrency(subtotal)}</strong>
              </div>
              {template.sections.tax && (
                <div>
                  {t("tax")}: <strong>{formatCurrency(taxAmount)}</strong>
                </div>
              )}
              {template.sections.retainage && canRetainage && template.features.supportsRetainage && (
                <div>
                  {t("retainage")}: <strong>{formatCurrency(retainageAmount)}</strong>
                </div>
              )}
              <div>
                {t("total")}: <strong className="text-base">{formatCurrency(total)}</strong>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t("saving") : t("createInvoice")}
        </Button>
      </div>
    </form>
  );
}
