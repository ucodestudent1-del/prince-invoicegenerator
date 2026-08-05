import { Suspense } from "react";
import { CustomizationSettings } from "@/components/customization-settings";
import { getCurrentUser, getActivePlan } from "@/lib/org";
import { hasFeature } from "@/lib/plans";
import { PricingFeature } from "@/components/pricing-feature";

export const metadata = {
  title: "Branding & Customization",
};

export default async function CustomizationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Branding &amp; Customization</h1>
        <p className="text-muted-foreground">
          Personalize the look and feel of your invoices and dashboard.
        </p>
      </div>
      <Suspense fallback={<p>Loading…</p>}>
        <CustomizationContent />
      </Suspense>
    </div>
  );
}

async function CustomizationContent() {
  const user = await getCurrentUser();
  if (!user) return null;
  const plan = await getActivePlan(user);
  if (!hasFeature(plan, "customBranding")) {
    return <PricingFeature feature="customBranding" plan={plan} />;
  }

  return <CustomizationSettings />;
}
