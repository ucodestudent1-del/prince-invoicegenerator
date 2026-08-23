"use client";

import * as React from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { createEstimate } from "@/lib/actions/features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { CatalogItemSelector } from "@/components/catalog-item-selector";

export function EstimateForm({ customers, canUseCatalog }: { customers: { id: string; name: string }[]; canUseCatalog: boolean }) {
  const t = useTranslations("estimates");
  const router = useRouter();
  const [error, setError] = React["useState"]<string | null>(null);
  const [saving, setSaving] = React["useState"](false);
  const [customerId, setCustomerId] = React["useState"]("");
  const [validUntil, setValidUntil] = React["useState"]("");
  const [taxRate, setTaxRate] = React["useState"]<string | number>(0);
  const [discount, setDiscount] = React["useState"]<string | number>(0);
  const [notes, setNotes] = React["useState"]("");
  const [items, setItems] = React["useState"]([{ description: "", quantity: 1, unitPrice: 0, sku: "" }]);

  const subtotal = items["reduce"]((a, i) => a + i["quantity"] * (Number(i["unitPrice"]) || 0), 0);
  const taxAmount = ((subtotal * (Number(taxRate) || 0)) / 100);
  const total = subtotal + taxAmount - (Number(discount) || 0);

  function updateItem(idx: number, field: string, value: any) {
    setItems((p) => p["map"]((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  async function submit(e: React.FormEvent) {
    e["preventDefault"]();
    setError(null);
    if (!customerId) return setError(t("customerRequired"));
    setSaving(true);
    try {
      await createEstimate({
        customerId,
        validUntil: validUntil || null,
        taxRate: Number(taxRate) || 0,
        discount: Number(discount) || 0,
        notes,
        items: items
          ["filter"]((i) => i["description"])
            ["map"]((i) => ({
              description: i["description"],
              quantity: Number(i["quantity"]) || 0,
              unitPrice: Number(i["unitPrice"]) || 0,
              sku: i["sku"] || null,
            })),
      });
      router["push"]("/dashboard/estimates");
      router["refresh"]();
    } catch (err: any) {
      setError(err?.["message"] ?? t("failed"));
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
          <CardTitle className="text-lg">{t("details")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
           <div className="space-y-1">
             <Label htmlFor="customer">{t("customer")}</Label>
             {customers["length"] === 0 ? (
               <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                 {t("noCustomersFound")}{" "}
                 <Link
                   href="/dashboard/customers/new"
                   className="text-primary underline"
                 >
                   {t("create")}.
                 </Link>
               </div>
             ) : (
               <Select value={customerId} onValueChange={setCustomerId}>
                 <SelectTrigger id="customer">
                   <SelectValue placeholder={t("selectCustomer")} />
                 </SelectTrigger>
                 <SelectContent>
                   {customers["map"]((c) => (
                     <SelectItem key={c["id"]} value={c["id"]}>
                       {c["name"]}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             )}
           </div>
          <div className="space-y-1">
            <Label htmlFor="validUntil">{t("validUntil")}</Label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e["target"]["value"])} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t("lineItems")}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((p) => [...p, { description: "", quantity: 1, unitPrice: 0, sku: "" }])}
          >
            {t("addItem")}
          </Button>
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
                     if (item["taxRate"] > 0) setTaxRate(item["taxRate"]);
                   }}
                   trigger={<Button type="button" variant="outline" size="sm">Browse</Button>}
                 />
               )}
               <Input
                 placeholder={t("description")}
                 className="flex-1"
                 value={it["description"]}
                 onChange={(e) => updateItem(idx, "description", e["target"]["value"])}
               />
              <Input
                type="number"
                className="w-20"
                value={it["quantity"]}
                onChange={(e) => updateItem(idx, "quantity", e["target"]["value"] === "" ? "" : Number(e["target"]["value"]))}
              />
              <Input
                type="number"
                className="w-28"
                step="0.01"
                value={it["unitPrice"]}
                onChange={(e) => updateItem(idx, "unitPrice", e["target"]["value"] === "" ? "" : Number(e["target"]["value"]))}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setItems((p) => p["filter"]((_, i) => i !== idx))}
              >
                ✕
              </Button>
            </div>
          ))}
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="taxRate">{t("taxRate")}</Label>
              <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e["target"]["value"] === "" ? "" : Number(e["target"]["value"]))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="discount">{t("discount")}</Label>
              <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e["target"]["value"] === "" ? "" : Number(e["target"]["value"]))} />
            </div>
          </div>
          <Textarea placeholder={t("notes")} value={notes} onChange={(e) => setNotes(e["target"]["value"])} />
          <div className="flex justify-end gap-6 text-sm">
            <div>{t("subtotal")}: <strong>{formatCurrency(subtotal)}</strong></div>
            <div>{t("tax")}: <strong>{formatCurrency(taxAmount)}</strong></div>
            <div>{t("total")}: <strong className="text-base">{formatCurrency(total)}</strong></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router["back"]()}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t("saving") : t("createEstimate")}
        </Button>
      </div>
    </form>
  );
}
