"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { createProject } from "@/lib/actions/features";
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
import { useTranslations } from "next-intl";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { PROJECT_TYPES, PROJECT_TYPE_LABEL, DEFAULT_PROJECT_TYPE, type ProjectTypeKey } from "@/lib/project-types";
import { formatCurrency } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
}

interface ProjectFormProps {
  customers: Customer[];
}

const STEPS = ["projectInfo", "financials", "review"] as const;

export function ProjectForm({ customers }: ProjectFormProps) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [step, setStep] = React.useState(0);

  // Step 0 — project info
  const [name, setName] = React.useState("");
  const [number, setNumber] = React.useState("");
  const [customerId, setCustomerId] = React.useState("");
  const [projectType, setProjectType] = React.useState<ProjectTypeKey>(DEFAULT_PROJECT_TYPE);
  const [address, setAddress] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  // Step 1 — financials
  const [contractValue, setContractValue] = React.useState("");
  const [estimatedCost, setEstimatedCost] = React.useState("");
  const [estCompletionDate, setEstCompletionDate] = React.useState("");
  const [paymentTerms, setPaymentTerms] = React.useState("NET_30");
  const [taxRate, setTaxRate] = React.useState("");
  const [retainageRate, setRetainageRate] = React.useState("");
  const [depositRequired, setDepositRequired] = React.useState("");
  const [projectManager, setProjectManager] = React.useState("");

  const canProceed = (): boolean => {
    if (step === 0) return !!name.trim();
    if (step === 1) return !!contractValue;
    return true;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createProject({
        name: name.trim(),
        description: description.trim() || null,
        projectType,
        customerId: customerId || null,
        address: address || undefined,
        startDate: startDate || null,
        endDate: endDate || null,
        estCompletionDate: estCompletionDate || null,
        contractValue: Number(contractValue) || 0,
        estimatedCost: Number(estimatedCost) || 0,
        paymentTerms,
        taxRate: Number(taxRate) || 0,
        retainageRate: Number(retainageRate) || 0,
        depositRequired: Number(depositRequired) || 0,
        projectManager: projectManager || undefined,
      });
      router.push("/dashboard/projects");
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? t("failed"));
      setSaving(false);
    }
  }

  function nextStep() {
    if (canProceed()) setStep(step + 1);
  }

  function prevStep() {
    setStep(step - 1);
  }

  const customerName = customers.find((c) => c["id"] === customerId)?.["name"] ?? null;

  // Derived values for the final-step financial summary so the contractor can
  // see the planned financial baseline before committing.
  const cv = Number(contractValue) || 0;
  const ec = Number(estimatedCost) || 0;
  const dep = Number(depositRequired) || 0;
  const estProfit = cv - ec;
  const estMargin = cv > 0 ? (estProfit / cv) * 100 : 0;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg">
          {step === 0 ? t("projectInfo") : step === 1 ? t("contractInfo") : t("reviewProject")}
        </CardTitle>
        <div className="flex gap-1 mt-2">
          {STEPS["map"]((s, i) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {step === 0 && (
            <>
              <div className="space-y-1">
                <Label htmlFor="name">{t("name")} *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="number">{t("projectNumber")}</Label>
                <Input
                  id="number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder={t("projectNumberPlaceholder")}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="customerId">{t("customer")} *</Label>
                {customers.length === 0 ? (
                  <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    {t("noCustomersFound")}{" "}
                    <a
                      href="/dashboard/customers/new"
                      className="text-primary underline"
                    >
                      {tCommon("create")}.
                    </a>
                  </div>
                ) : (
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger id="customerId">
                      <SelectValue placeholder={t("selectCustomer")} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="projectType">{t("projectType")}</Label>
                <Select value={projectType} onValueChange={(v) => setProjectType(v as ProjectTypeKey)}>
                  <SelectTrigger id="projectType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPES.map((pt) => (
                      <SelectItem key={pt} value={pt}>
                        {PROJECT_TYPE_LABEL[pt]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="address">{t("address")}</Label>
                <Textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t("addressPlaceholder")}
                  rows={2}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="description">{t("description")}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("descriptionPlaceholder")}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>

              <div className="space-y-1">
                <Label htmlFor="projectManager">{t("projectManager")}</Label>
                <Input
                  id="projectManager"
                  value={projectManager}
                  onChange={(e) => setProjectManager(e.target.value)}
                  placeholder={t("projectManagerPlaceholder")}
                />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-1">
                <Label htmlFor="contractValue">{t("contractValue")} *</Label>
                <Input
                  id="contractValue"
                  type="number"
                  step="0.01"
                  min="0"
                  value={contractValue}
                  onChange={(e) => setContractValue(e.target.value)}
                  placeholder={t("contractValuePlaceholder")}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="estimatedCost">{t("estimatedCost")}</Label>
                <Input
                  id="estimatedCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder={t("estimatedCostPlaceholder")}
                />
                <p className="text-xs text-muted-foreground">{t("estimatedCostHelp")}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="estCompletionDate">{t("estCompletionDate")}</Label>
                  <Input
                    id="estCompletionDate"
                    type="date"
                    value={estCompletionDate}
                    onChange={(e) => setEstCompletionDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="paymentTerms">{t("paymentTerms")}</Label>
                  <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger id="paymentTerms">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NET_30">{t("net30")}</SelectItem>
                      <SelectItem value="NET_15">{t("net15")}</SelectItem>
                      <SelectItem value="NET_7">{t("net7")}</SelectItem>
                      <SelectItem value="COD">{t("cod")}</SelectItem>
                      <SelectItem value="CUSTOM">{t("custom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="taxRate">{t("taxRate")}</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    placeholder="8.875"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="retainageRate">{t("retainageRate")}</Label>
                  <Input
                    id="retainageRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={retainageRate}
                    onChange={(e) => setRetainageRate(e.target.value)}
                    placeholder="5"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="depositRequired">{t("depositRequired")}</Label>
                <Input
                  id="depositRequired"
                  type="number"
                  step="0.01"
                  min="0"
                  value={depositRequired}
                  onChange={(e) => setDepositRequired(e.target.value)}
                  placeholder={t("depositRequiredPlaceholder")}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="font-medium text-muted-foreground">{t("name")}:</span>{" "}
                  <span>{name || t("notSet")}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">{t("customer")}:</span>{" "}
                  <span>{customerName ?? t("notSet")}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">{t("projectType")}:</span>{" "}
                  <span>{PROJECT_TYPE_LABEL[projectType]}</span>
                </div>
                {address && (
                  <div>
                    <span className="font-medium text-muted-foreground">{t("address")}:</span>{" "}
                    <span>{address}</span>
                  </div>
                )}
                {description && (
                  <div className="sm:col-span-2">
                    <span className="font-medium text-muted-foreground">{t("description")}:</span>{" "}
                    <span className="whitespace-pre-line">{description}</span>
                  </div>
                )}
                {(startDate || endDate) && (
                  <div>
                    <span className="font-medium text-muted-foreground">{t("startDate")} → {t("endDate")}:</span>{" "}
                    <span>{startDate || "—"} → {endDate || "—"}</span>
                  </div>
                )}
                {projectManager && (
                  <div>
                    <span className="font-medium text-muted-foreground">{t("projectManager")}:</span>{" "}
                    <span>{projectManager}</span>
                  </div>
                )}
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold mb-2">{t("financialSummary")}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="font-medium text-muted-foreground">{t("contractValue")}:</span>{" "}
                    <span className="font-semibold">{formatCurrency(cv)}</span>
                  </div>
                  {ec > 0 && (
                    <div>
                      <span className="font-medium text-muted-foreground">{t("estimatedCost")}:</span>{" "}
                      <span>{formatCurrency(ec)}</span>
                    </div>
                  )}
                  {ec > 0 && (
                    <div>
                      <span className="font-medium text-muted-foreground">{t("estimatedProfit")}:</span>{" "}
                      <span className={estProfit >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                        {formatCurrency(estProfit)} ({estMargin.toFixed(1)}%)
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-muted-foreground">{t("paymentTerms")}:</span>{" "}
                    <span>{paymentTerms || t("notSet")}</span>
                  </div>
                  {Number(taxRate) > 0 && (
                    <div>
                      <span className="font-medium text-muted-foreground">{t("taxRate")}:</span>{" "}
                      <span>{taxRate}%</span>
                    </div>
                  )}
                  {Number(retainageRate) > 0 && (
                    <div>
                      <span className="font-medium text-muted-foreground">{t("retainageRate")}:</span>{" "}
                      <span>{retainageRate}%</span>
                    </div>
                  )}
                  {dep > 0 && (
                    <div>
                      <span className="font-medium text-muted-foreground">{t("depositRequired")}:</span>{" "}
                      <span>{formatCurrency(dep)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-3 text-xs text-muted-foreground">
                {t("reviewNote")}
              </div>
            </div>
          )}

          <div className="flex justify-between gap-2 pt-4 border-t">
            {step > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={prevStep}>
                <ChevronLeft className="mr-1 h-4 w-4" /> {tCommon("back")}
              </Button>
            ) : (
              <div />
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" size="sm" onClick={nextStep} disabled={!canProceed()}>
                {tCommon("next")} <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" size="sm" disabled={saving || !canProceed()}>
                {saving ? tCommon("saving") : (
                  <>
                    <Check className="mr-1 h-4 w-4" /> {t("createProject")}
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
