"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { createCustomer } from "@/lib/actions/customers";
import { updateCustomer } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";

interface CustomerFormProps {
  customerId?: string;
  initialData?: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    address?: string;
    notes?: string;
  };
}

export function CustomerForm({ customerId, initialData }: CustomerFormProps = {}) {
  const t = useTranslations("customers");
  const router = useRouter();
  const isEdit = !!customerId;
  const [error, setError] = React["useState"]<string | null>(null);
  const [saving, setSaving] = React["useState"](false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e["preventDefault"]();
    setSaving(true);
    setError(null);
    const fd = new FormData(e["currentTarget"]);
    const payload = {
      name: String(fd["get"]("name") || ""),
      company: String(fd["get"]("company") || "") || undefined,
      email: String(fd["get"]("email") || "") || undefined,
      phone: String(fd["get"]("phone") || "") || undefined,
      address: String(fd["get"]("address") || "") || undefined,
      notes: String(fd["get"]("notes") || "") || undefined,
    };
    try {
      if (isEdit) {
        await updateCustomer(customerId!, payload);
      } else {
        await createCustomer(payload);
      }
      router["push"]("/dashboard/customers");
      router["refresh"]();
    } catch (err: any) {
      setError(err?.["message"] ?? t("failedToSave"));
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg">{isEdit ? "Edit customer" : t("new")}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="name">{t("name")} *</Label>
              <Input id="name" name="name" required defaultValue={initialData?.["name"]} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="company">{t("company")}</Label>
              <Input id="company" name="company" defaultValue={initialData?.["company"]} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" name="email" type="email" defaultValue={initialData?.["email"]} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input id="phone" name="phone" defaultValue={initialData?.["phone"]} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="address">{t("address")}</Label>
            <Input id="address" name="address" defaultValue={initialData?.["address"]} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">{t("notes")}</Label>
            <Textarea id="notes" name="notes" defaultValue={initialData?.["notes"]} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router["back"]()}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
