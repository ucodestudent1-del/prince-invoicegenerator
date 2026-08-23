import { Suspense } from "react";
import { TemplateCustomizationSettings } from "@/components/template-customization-settings";
import { getTemplateSettings, getBrandColors, getFontSettings, getLayoutSettings } from "@/lib/actions/customization";
import { getCurrentUser, getActivePlan } from "@/lib/org";
import { hasFeature } from "@/lib/plans";
import { PricingFeature } from "@/components/pricing-feature";
import { getTranslations } from "next-intl/server";

export const metadata = {
  title: "Invoice Templates",
};

export default async function TemplatesPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("templates");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <Suspense fallback={<p>Loading…</p>}>
        <TemplatesContent locale={params["locale"]} t={t} />
      </Suspense>
    </div>
  );
}

async function TemplatesContent({ locale, t }: { locale: string; t: any }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const plan = await getActivePlan(user);
  if (!hasFeature(plan, "invoiceTemplates") && !hasFeature(plan, "customBranding")) {
    return <PricingFeature feature="customBranding" plan={plan} />;
  }

  const [current, colors, fonts, layout] = await Promise["all"]([
    getTemplateSettings(),
    getBrandColors(),
    getFontSettings(),
    getLayoutSettings(),
  ]);

  return (
    <div className="space-y-6">
      <TemplateCustomizationSettings
        current={current}
        brandColor={colors["brandColor"]}
        accentColor={colors["accentColor"]}
        fontFamily={fonts}
        layout={layout}
      />
      <div className="rounded-md bg-muted/50 p-4">
        <h3 className="font-medium mb-2">{t("previews")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("previewHint")}
        </p>
      </div>
    </div>
  );
}
