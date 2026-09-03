"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { updateProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";

interface Customer {
  id: string;
  name: string;
}

interface EditProjectFormProps {
  projectId: string;
  initial: {
    name: string;
    number: string | null;
    address: string | null;
    customerId: string | null;
    startDate: string | null;
    endDate: string | null;
    estCompletionDate: string | null;
    contractValue: number;
    paymentTerms: string;
    taxRate: number;
    retainageRate: number;
    depositRequired: number;
    projectManager: string | null;
    status: string;
  };
  customers: Customer[];
}

export function EditProjectForm({ projectId, initial, customers }: EditProjectFormProps) {
  const t = useTranslations("projects");
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [name, setName] = React.useState(initial["name"] ?? "");
  const [number, setNumber] = React.useState(initial["number"] ?? "");
  const [address, setAddress] = React.useState(initial["address"] ?? "");
  const [customerId, setCustomerId] = React.useState(initial["customerId"] ?? "");
  const [startDate, setStartDate] = React.useState(initial["startDate"]?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = React.useState(initial["endDate"]?.slice(0, 10) ?? "");
  const [estCompletionDate, setEstCompletionDate] = React.useState(
    initial["estCompletionDate"]?.slice(0, 10) ?? ""
  );
  const [contractValue, setContractValue] = React.useState(
    String(initial["contractValue"] ?? 0)
  );
  const [paymentTerms, setPaymentTerms] = React.useState(initial["paymentTerms"] ?? "NET_30");
  const [taxRate, setTaxRate] = React.useState(String(initial["taxRate"] ?? 0));
  const [retainageRate, setRetainageRate] = React.useState(
    String(initial["retainageRate"] ?? 0)
  );
  const [depositRequired, setDepositRequired] = React.useState(
    String(initial["depositRequired"] ?? 0)
  );
  const [projectManager, setProjectManager] = React.useState(initial["projectManager"] ?? "");
  const [status, setStatus] = React.useState(initial["status"] ?? "ACTIVE");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateProject(projectId, {
        name: name || undefined,
        number: number || undefined,
        address: address || null,
        customerId: customerId || null,
        startDate: startDate || null,
        endDate: endDate || null,
        estCompletionDate: estCompletionDate || null,
        contractValue: Number(contractValue) || 0,
        paymentTerms: paymentTerms || undefined,
        taxRate: Number(taxRate) || 0,
        retainageRate: Number(retainageRate) || 0,
        depositRequired: Number(depositRequired) || 0,
        projectManager: projectManager || null,
        status: status || undefined,
      });
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Failed");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="name">{t("name")} *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="number">{t("projectNumber")}</Label>
          <Input
            id="number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="customerId">{t("customer")}</Label>
        <select
          id="customerId"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value || "")}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">{t("none")}</option>
          {customers["map"]((c) => (
            <option key={c["id"]} value={c["id"]}>
              {c["name"]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="address">{t("address")}</Label>
        <Textarea
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="startDate">{t("startDate")}</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="endDate">{t("endDate")}</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="estCompletionDate">{t("estCompletionDate")}</Label>
          <Input
            id="estCompletionDate"
            type="date"
            value={estCompletionDate}
            onChange={(e) => setEstCompletionDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="contractValue">{t("contractValue")}</Label>
          <Input
            id="contractValue"
            type="number"
            step="0.01"
            value={contractValue}
            onChange={(e) => setContractValue(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="taxRate">{t("taxRate")}</Label>
          <Input
            id="taxRate"
            type="number"
            step="0.01"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="retainageRate">{t("retainageRate")}</Label>
          <Input
            id="retainageRate"
            type="number"
            step="0.01"
            value={retainageRate}
            onChange={(e) => setRetainageRate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="depositRequired">{t("depositRequired")}</Label>
          <Input
            id="depositRequired"
            type="number"
            step="0.01"
            value={depositRequired}
            onChange={(e) => setDepositRequired(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="paymentTerms">{t("paymentTerms")}</Label>
          <Input
            id="paymentTerms"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="projectManager">{t("projectManager")}</Label>
          <Input
            id="projectManager"
            value={projectManager}
            onChange={(e) => setProjectManager(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="status">{t("status")}</Label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="ACTIVE">{t("statusActive")}</option>
          <option value="COMPLETED">{t("statusCompleted")}</option>
          <option value="ON_HOLD">{t("statusOnHold")}</option>
          <option value="CANCELLED">{t("statusCancelled")}</option>
        </select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : t("save")}
        </Button>
      </div>
    </form>
  );
}
