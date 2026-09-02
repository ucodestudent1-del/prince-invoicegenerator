"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { createChangeOrder } from "@/lib/actions/features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";

export function ChangeOrderForm({
  invoices,
  customers,
  projects,
}: {
  invoices: { id: string; number: string }[];
  customers: { id: string; name: string; company?: string | null }[];
  projects: { id: string; name: string; number?: string | null }[];
}) {
  const t = useTranslations("changeOrders");
  const router = useRouter();
  const [error, setError] = React["useState"]<string | null>(null);
  const [saving, setSaving] = React["useState"](false);
  const [originalTotalVal, setOriginalTotalVal] = React["useState"](0);
  const [amountVal, setAmountVal] = React["useState"](0);
  const newContractPrice = originalTotalVal + amountVal;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e["preventDefault"]();
    setSaving(true);
    setError(null);
    const fd = new FormData(e["currentTarget"]);
    try {
      await createChangeOrder({
        title: String(fd["get"]("title") || ""),
        description: String(fd["get"]("description") || "") || undefined,
        projectId: String(fd["get"]("projectId") || "") || null,
        customerId: String(fd["get"]("customerId") || "") || null,
        invoiceId: String(fd["get"]("invoiceId") || "") || null,
        amount: Number(fd["get"]("amount") || 0),
        originalTotal: Number(fd["get"]("originalTotal") || 0),
        daysAdded: fd["get"]("daysAdded") ? Number(fd["get"]("daysAdded")) : null,
        originalCompletionDate:
          String(fd["get"]("originalCompletionDate") || "") || null,
        newCompletionDate:
          String(fd["get"]("newCompletionDate") || "") || null,
        billToAddress: String(fd["get"]("billToAddress") || "") || null,
        scopeChangeDescription:
          String(fd["get"]("scopeChangeDescription") || "") || undefined,
        scheduleImpactDescription:
          String(fd["get"]("scheduleImpactDescription") || "") || undefined,
      });
      router["push"]("/dashboard/change-orders");
      router["refresh"]();
    } catch (err: any) {
      setError(err?.["message"] ?? t("failed"));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 1. Project Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("projectInformation")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="title">{t("title")}</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="projectId">{t("project")}</Label>
              <select
                id="projectId"
                name="projectId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">{t("none")}</option>
                {projects["map"]((p) => (
                  <option key={p["id"]} value={p["id"]}>
                    {p["name"]} {p["number"] ? `#${p["number"]}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="customerId">{t("clientName")}</Label>
              <select
                id="customerId"
                name="customerId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">{t("none")}</option>
                {customers["map"]((c) => (
                  <option key={c["id"]} value={c["id"]}>
                    {c["name"] || c["company"] || "—"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="issueDate">{t("dateOfIssue")}</Label>
              <Input
                id="issueDate"
                name="issueDate"
                type="date"
                defaultValue={new Date()["toISOString"]()["slice"](0, 10)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="billToAddress">{t("locationOfWork")}</Label>
            <Textarea id="billToAddress" name="billToAddress" rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* 2. Change Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("changeDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="description">{t("changeDescription")}</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              placeholder={t("changeDescriptionPlaceholder")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="scopeChangeDescription">{t("costWorkBreakdown")}</Label>
            <Textarea
              id="scopeChangeDescription"
              name="scopeChangeDescription"
              rows={4}
              placeholder={t("costWorkBreakdownPlaceholder")}
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Financial Impact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("financialImpact")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="originalTotal">{t("originalContractPrice")}</Label>
              <Input
                id="originalTotal"
                name="originalTotal"
                type="number"
                step="0.01"
                min={0}
                value={originalTotalVal || ""}
                onChange={(e) => setOriginalTotalVal(Number(e["target"]["value"] || 0))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount">{t("priceOfChange")}</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min={0}
                value={amountVal || ""}
                onChange={(e) => setAmountVal(Number(e["target"]["value"] || 0))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="revisedTotal">{t("newContractPrice")}</Label>
              <Input
                id="revisedTotal"
                name="revisedTotal"
                type="number"
                step="0.01"
                min={0}
                value={newContractPrice}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Schedule Impact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("scheduleImpact")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="originalCompletionDate">{t("originalCompletionDate")}</Label>
              <Input id="originalCompletionDate" name="originalCompletionDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="daysAdded">{t("daysAdded")}</Label>
              <Input id="daysAdded" name="daysAdded" type="number" min={0} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newCompletionDate">{t("newCompletionDate")}</Label>
              <Input id="newCompletionDate" name="newCompletionDate" type="date" />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="scheduleImpactDescription">{t("scheduleImpactDescription")}</Label>
            <Textarea
              id="scheduleImpactDescription"
              name="scheduleImpactDescription"
              rows={3}
              placeholder={t("scheduleImpactPlaceholder")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Linked Invoice (optional) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("additionalOptions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="invoiceId">{t("linkedInvoice")}</Label>
            <select
              id="invoiceId"
              name="invoiceId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">{t("none")}</option>
              {invoices["map"]((i) => (
                <option key={i["id"]} value={i["id"]}>
                  {i["number"]}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router["back"]()}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t("saving") : t("create")}
        </Button>
      </div>
    </form>
  );
}
