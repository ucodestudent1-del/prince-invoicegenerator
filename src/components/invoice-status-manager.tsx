"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_KEYS: Record<string, string> = {
  DRAFT: "draft",
  SENT: "sent",
  VIEWED: "viewed",
  UNPAID: "unpaid",
  PAID: "paid",
  OVERDUE: "overdue",
  VOID: "void",
};

export function InvoiceStatusManager({
  invoiceId,
  currentStatus,
}: {
  invoiceId: string;
  currentStatus: string;
}) {
  const t = useTranslations("status");
  const [status, setStatus] = React["useState"](currentStatus);
  const [saving, setSaving] = React["useState"](false);

  async function handleChange(newStatus: string) {
    setStatus(newStatus);
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON["stringify"]({ status: newStatus }),
      });
      if (!res["ok"]) {
        const data = await res["json"]();
        alert(data["error"] || t("failedUpdate"));
        setStatus(currentStatus);
      }
    } catch (err) {
      alert(t("failedUpdate"));
      setStatus(currentStatus);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("invoiceStatus")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Select value={status} onValueChange={handleChange} disabled={saving}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object["entries"](STATUS_KEYS)["map"](([value, key]) => (
                <SelectItem key={value} value={value}>
                  {t(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saving && <span className="text-xs text-muted-foreground">{t("saving")}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
