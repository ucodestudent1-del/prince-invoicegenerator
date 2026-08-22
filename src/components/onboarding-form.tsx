"use client";

import * as React from "react";
import { useRouter, getPathnameWithLocale } from "@/i18n/navigation";
import { useLocaleSafe } from "@/hooks/use-locale-safe";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveOnboardingStep, completeOnboarding, type OnboardingStep, type IdentityData, type ContactData, type ComplianceData } from "@/lib/actions/onboarding";

const STEPS: { key: OnboardingStep; labelKey: string }[] = [
  { key: "identity", labelKey: "identityStep" },
  { key: "contact", labelKey: "contactStep" },
  { key: "compliance", labelKey: "complianceStep" },
  { key: "review", labelKey: "reviewStep" },
];

const INDUSTRIES = [
  "Construction",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Roofing",
  "Painting",
  "Carpentry",
  "Landscaping",
  "General Contracting",
  "Other",
];

const BUSINESS_TYPES = [
  "Sole Proprietorship",
  "LLC",
  "S-Corp",
  "C-Corp",
  "Partnership",
  "Non-Profit",
  "Other",
];

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "MX", name: "Mexico" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
];

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Australia/Sydney",
  "Asia/Tokyo",
  "Asia/Kolkata",
];

const DATE_FORMATS = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

const NUMBER_FORMATS = [
  { value: "en-US", label: "1,000.00 (US)" },
  { value: "de-DE", label: "1.000,00 (EU)" },
  { value: "en-GB", label: "1,000.00 (UK)" },
];

const PAYMENT_TERMS = [
  { value: "DUE_ON_RECEIPT", label: "Due on receipt" },
  { value: "NET_7", label: "Net 7" },
  { value: "NET_15", label: "Net 15" },
  { value: "NET_30", label: "Net 30" },
  { value: "NET_60", label: "Net 60" },
];

export default function OnboardingForm({ initialData }: { 
  initialData?: {
    identity: IdentityData | null;
    contact: ContactData | null;
    compliance: ComplianceData | null;
    currentStep: OnboardingStep;
    autoDetected?: {
      country: string;
      currency: string;
      timezone: string;
      language: string;
      dateFormat: string;
      numberFormat: string;
    };
  };
}) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const locale = useLocaleSafe();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [step, setStep] = React.useState<OnboardingStep>(initialData?.currentStep || "identity");
  const [identity, setIdentity] = React.useState<IdentityData>(
    initialData?.identity || { businessName: "" }
  );
  const [contact, setContact] = React.useState<ContactData>(
    initialData?.contact || { 
      addressLine1: "", 
      city: "", 
      postalCode: "", 
      country: initialData?.autoDetected?.country || "US", 
      email: "" 
    }
  );
  const [compliance, setCompliance] = React.useState<ComplianceData>(
    initialData?.compliance || {
      ...(initialData?.autoDetected || { currency: "USD", language: "en", timezone: "America/New_York", dateFormat: "MM/DD/YYYY", numberFormat: "en-US" }),
      defaultTaxRate: 0,
      defaultPaymentTerms: "NET_30",
    }
  );

  const currentIndex = STEPS.findIndex((s) => s.key === step);

  async function handleNext() {
    setError(null);
    setSaving(true);
    try {
      await saveOnboardingStep(step, step === "identity" ? identity : step === "contact" ? contact : compliance);
      const nextIndex = currentIndex + 1;
      if (nextIndex < STEPS.length) {
        setStep(STEPS[nextIndex].key);
      }
    } catch (err: any) {
      setError(err?.message || t("failedToSave"));
    } finally {
      setSaving(false);
    }
  }

  async function handleBack() {
    setError(null);
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex].key);
    }
  }

  async function handleComplete() {
    setError(null);
    setSaving(true);
    try {
      await completeOnboarding();
      router.push(getPathnameWithLocale({ href: "/dashboard", locale }));
      router.refresh();
    } catch (err: any) {
      setError(err?.message || t("failedToSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            {i > 0 && <div className="h-px flex-1 bg-muted" />}
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  i <= currentIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <span className="text-sm font-medium">{t(s.labelKey)}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t(`${step}StepTitle`)}</CardTitle>
          <CardDescription>{t(`${step}StepDescription`)}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === "identity" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="businessName">{t("businessName")} *</Label>
                <Input
                  id="businessName"
                  value={identity.businessName}
                  onChange={(e) => setIdentity({ ...identity, businessName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="industry">{t("industry")}</Label>
                <Select
                  value={identity.industry}
                  onValueChange={(value) => setIdentity({ ...identity, industry: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectIndustry")} />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="businessType">{t("businessType")}</Label>
                <Select
                  value={identity.businessType}
                  onValueChange={(value) => setIdentity({ ...identity, businessType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectBusinessType")} />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((bt) => (
                      <SelectItem key={bt} value={bt}>
                        {bt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="website">{t("website")}</Label>
                <Input
                  id="website"
                  value={identity.website || ""}
                  onChange={(e) => setIdentity({ ...identity, website: e.target.value })}
                />
              </div>
            </div>
          )}

          {step === "contact" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="addressLine1">{t("addressLine1")} *</Label>
                <Input
                  id="addressLine1"
                  value={contact.addressLine1}
                  onChange={(e) => setContact({ ...contact, addressLine1: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="addressLine2">{t("addressLine2")}</Label>
                <Input
                  id="addressLine2"
                  value={contact.addressLine2 || ""}
                  onChange={(e) => setContact({ ...contact, addressLine2: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="city">{t("city")} *</Label>
                  <Input
                    id="city"
                    value={contact.city}
                    onChange={(e) => setContact({ ...contact, city: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="state">{t("state")}</Label>
                  <Input
                    id="state"
                    value={contact.state || ""}
                    onChange={(e) => setContact({ ...contact, state: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="postalCode">{t("postalCode")} *</Label>
                  <Input
                    id="postalCode"
                    value={contact.postalCode}
                    onChange={(e) => setContact({ ...contact, postalCode: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="country">{t("country")} *</Label>
                  <Select
                    value={contact.country}
                    onValueChange={(value) => setContact({ ...contact, country: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">{t("phone")}</Label>
                <Input
                  id="phone"
                  value={contact.phone || ""}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">{t("businessEmail")} *</Label>
                <Input
                  id="email"
                  type="email"
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  required
                />
              </div>
            </div>
          )}

          {step === "compliance" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="taxId">{t("taxId")}</Label>
                <Input
                  id="taxId"
                  value={compliance.taxId || ""}
                  onChange={(e) => setCompliance({ ...compliance, taxId: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="currency">{t("currency")} *</Label>
                <Select
                  value={compliance.currency}
                  onValueChange={(value) => setCompliance({ ...compliance, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.symbol} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="timezone">{t("timezone")} *</Label>
                <Select
                  value={compliance.timezone}
                  onValueChange={(value) => setCompliance({ ...compliance, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="dateFormat">{t("dateFormat")} *</Label>
                  <Select
                    value={compliance.dateFormat}
                    onValueChange={(value) => setCompliance({ ...compliance, dateFormat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_FORMATS.map((df) => (
                        <SelectItem key={df.value} value={df.value}>
                          {df.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="numberFormat">{t("numberFormat")} *</Label>
                  <Select
                    value={compliance.numberFormat}
                    onValueChange={(value) => setCompliance({ ...compliance, numberFormat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NUMBER_FORMATS.map((nf) => (
                        <SelectItem key={nf.value} value={nf.value}>
                          {nf.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="defaultTaxRate">{t("defaultTaxRate")}</Label>
                  <Input
                    id="defaultTaxRate"
                    type="number"
                    min="0"
                    max="100"
                    value={compliance.defaultTaxRate}
                    onChange={(e) => setCompliance({ ...compliance, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="defaultPaymentTerms">{t("defaultPaymentTerms")}</Label>
                  <Select
                    value={compliance.defaultPaymentTerms}
                    onValueChange={(value) => setCompliance({ ...compliance, defaultPaymentTerms: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map((pt) => (
                        <SelectItem key={pt.value} value={pt.value}>
                          {pt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div className="rounded-md border p-4">
                <h3 className="font-semibold">{t("businessIdentity")}</h3>
                <p className="text-sm text-muted-foreground">{identity.businessName}</p>
                {identity.industry && <p className="text-sm text-muted-foreground">{identity.industry}</p>}
                {identity.website && <p className="text-sm text-muted-foreground">{identity.website}</p>}
              </div>
              <div className="rounded-md border p-4">
                <h3 className="font-semibold">{t("contactInformation")}</h3>
                <p className="text-sm text-muted-foreground">{contact.addressLine1}</p>
                {contact.addressLine2 && <p className="text-sm text-muted-foreground">{contact.addressLine2}</p>}
                <p className="text-sm text-muted-foreground">
                  {contact.city}
                  {contact.state ? `, ${contact.state}` : ""} {contact.postalCode}
                </p>
                <p className="text-sm text-muted-foreground">
                  {COUNTRIES.find((c) => c.code === contact.country)?.name || contact.country}
                </p>
                {contact.phone && <p className="text-sm text-muted-foreground">{contact.phone}</p>}
                <p className="text-sm text-muted-foreground">{contact.email}</p>
              </div>
              <div className="rounded-md border p-4">
                <h3 className="font-semibold">{t("complianceLocalization")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("currency")}: {compliance.currency}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("timezone")}: {compliance.timezone.replace("_", " ")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("dateFormat")}: {compliance.dateFormat}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("defaultTaxRate")}: {compliance.defaultTaxRate}%
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("defaultPaymentTerms")}: {compliance.defaultPaymentTerms.replace("NET_", "Net ")}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentIndex === 0 || saving}
            >
              {t("back")}
            </Button>
            {step === "review" ? (
              <Button onClick={handleComplete} disabled={saving}>
                {saving ? t("saving") : t("completeSetup")}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={saving}>
                {t("next")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
