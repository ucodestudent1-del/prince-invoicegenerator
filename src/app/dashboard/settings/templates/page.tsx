import { Suspense } from "react";
import { TemplateSelectorForm } from "@/components/template-selector";
import { getTemplateSettings } from "@/lib/actions/customization";
import { getCurrentUser, getActivePlan } from "@/lib/org";
import { hasFeature } from "@/lib/plans";
import { PricingFeature } from "@/components/pricing-feature";

export const metadata = {
  title: "Invoice Templates",
};

export default async function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoice Templates</h1>
        <p className="text-muted-foreground">Choose how your invoices look.</p>
      </div>
      <Suspense fallback={<p>Loading…</p>}>
        <TemplatesContent />
      </Suspense>
    </div>
  );
}

async function TemplatesContent() {
  const user = await getCurrentUser();
  if (!user) return null;
  const plan = await getActivePlan(user);
  if (!hasFeature(plan, "invoiceTemplates")) {
    return <PricingFeature feature="invoiceTemplates" plan={plan} />;
  }

  const current = await getTemplateSettings();

  return (
    <div className="space-y-6">
      <TemplateSelectorForm current={current} />
      <div className="rounded-md bg-muted/50 p-4">
        <h3 className="font-medium mb-2">Template previews</h3>
        <p className="text-sm text-muted-foreground">
          Templates are previewed in the invoice print view. Click a template
          card above to select it, then click &quot;Save template&quot;.
        </p>
      </div>
    </div>
  );
}
