"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createExpense } from "@/lib/actions/features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";

const CATEGORIES = [
  "LABOR",
  "MATERIALS",
  "EQUIPMENT",
  "SUBCONTRACTOR",
  "PERMITS",
  "TRAVEL",
  "OTHER",
];

export function ExpenseForm({
  r2Enabled,
}: {
  r2Enabled: boolean;
}) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [photoId, setPhotoId] = React.useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/photos", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (data.id) setPhotoId(data.id);
    else setError(data.error ?? t("uploadFailed"));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await createExpense({
        vendor: String(fd.get("vendor") || "") || undefined,
        category: (String(fd.get("category") || "OTHER") as any),
        amount: Number(fd.get("amount") || 0),
        date: String(fd.get("date") || "") || null,
        notes: String(fd.get("notes") || "") || undefined,
        projectId: String(fd.get("projectId") || "") || null,
        photoId,
      });
      router.push("/dashboard/expenses");
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="vendor">{t("vendor")}</Label>
              <Input id="vendor" name="vendor" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount">{t("amount")}</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min={0} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category">{t("category")}</Label>
              <select id="category" name="category" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t(`expenseCategories.${c}`)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="date">{t("date")}</Label>
              <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>
<div className="space-y-1">
              <Label htmlFor="projectId">{t("project")}</Label>
              <Input id="projectId" name="projectId" placeholder={t("enterProjectName")} />
            </div>
          {r2Enabled && (
            <div className="space-y-1">
              <Label htmlFor="photo">{t("photo")} (R2)</Label>
              <Input id="photo" type="file" accept="image/*" onChange={handleFile} disabled={uploading} />
              {uploading && <p className="text-xs text-muted-foreground">{t("uploading")}</p>}
              {photoId && <p className="text-xs text-emerald-600">{t("photoAttached")}</p>}
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="notes">{t("notes")}</Label>
            <Input id="notes" name="notes" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>{t("cancel")}</Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving ? t("saving") : t("create")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}