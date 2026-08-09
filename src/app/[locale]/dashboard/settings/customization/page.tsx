import { Suspense } from "react";
import { CustomizationSettings } from "@/components/customization-settings";
import { getCurrentUser, getActivePlan } from "@/lib/org";
import { hasFeature } from "@/lib/plans";
import { PricingFeature } from "@/components/pricing-feature";
import { getTranslations } from "next-intl/server";

export const metadata = {
  title: "Branding & Customization",
};

export default async function CustomizationPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("customization");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <Suspense fallback={<p>Loading…</p>}>
        <CustomizationContent locale={params.locale} t={t} />
      </Suspense>
    </div>
  );
}

async function CustomizationContent({ locale, t }: { locale: string; t: any }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const plan = await getActivePlan(user);
  if (!hasFeature(plan, "customBranding")) {
    return <PricingFeature feature="customBranding" plan={plan} />;
  }

  return <CustomizationSettings />;
}
