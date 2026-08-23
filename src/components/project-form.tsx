"use client";

import * as React from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { createProject } from "@/lib/actions/features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";

export function ProjectForm({ customers }: { customers: { id: string; name: string }[] }) {
  const t = useTranslations("projects");
  const router = useRouter();
  const [error, setError] = React["useState"]<string | null>(null);
  const [saving, setSaving] = React["useState"](false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e["preventDefault"]();
    setSaving(true);
    setError(null);
    const fd = new FormData(e["currentTarget"]);
    try {
      await createProject({
        name: String(fd["get"]("name") || ""),
        customerId: String(fd["get"]("customerId") || "") || null,
        address: String(fd["get"]("address") || "") || undefined,
        startDate: String(fd["get"]("startDate") || "") || null,
        endDate: String(fd["get"]("endDate") || "") || null,
      });
      router["push"]("/dashboard/projects");
      router["refresh"]();
    } catch (err: any) {
      setError(err?.["message"] ?? t("failed"));
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
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="customerId">{t("customer")}</Label>
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
              <select
                id="customerId"
                name="customerId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">{t("none")}</option>
                {customers["map"]((c) => (
                  <option key={c["id"]} value={c["id"]}>
                    {c["name"]}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="address">{t("address")}</Label>
            <Input id="address" name="address" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="startDate">{t("startDate")}</Label>
              <Input id="startDate" name="startDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="endDate">{t("endDate")}</Label>
              <Input id="endDate" name="endDate" type="date" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router["back"]()}>{t("cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("saving") : t("create")}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
