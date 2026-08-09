"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createChangeOrder } from "@/lib/actions/features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";

export function ChangeOrderForm({
  invoices,
}: {
  invoices: { id: string; number: string }[];
}) {
  const t = useTranslations("changeOrders");
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await createChangeOrder({
        title: String(fd.get("title") || ""),
        description: String(fd.get("description") || "") || undefined,
        projectId: String(fd.get("projectId") || "") || null,
        invoiceId: String(fd.get("invoiceId") || "") || null,
        amount: Number(fd.get("amount") || 0),
      });
      router.push("/dashboard/change-orders");
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? t("failed"));
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg">{t("new")}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="title">{t("title")}</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
<div className="space-y-1">
                <Label htmlFor="projectId">{t("project")}</Label>
                <Input id="projectId" name="projectId" placeholder={t("enterProjectName")} />
              </div>
            <div className="space-y-1">
              <Label htmlFor="invoiceId">{t("linkedInvoice")}</Label>
              <select id="invoiceId" name="invoiceId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">{t("none")}</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>{i.number}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="amount">{t("amount")}</Label>
            <Input id="amount" name="amount" type="number" step="0.01" min={0} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea id="description" name="description" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>{t("cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("saving") : t("create")}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}