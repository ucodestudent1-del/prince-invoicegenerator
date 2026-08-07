import Link from "next/link";
import { Check } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS, FEATURE_LABELS, type FeatureKey } from "@/lib/plans";
import { PricingCheckout } from "@/components/pricing-checkout";

const display = PLANS.map((p) => ({
  id: p.id,
  name: p.name,
  priceLabel: p.priceLabel,
  blurb: p.blurb,
  features: p.features.map((f) => FEATURE_LABELS[f as FeatureKey]),
}));

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="container py-16 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">
            Simple pricing that scales with your crew
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Start free. Upgrade to unlock estimates, retainage, change orders,
            recurring invoices, and team management.
          </p>
        </section>

        <section className="container grid gap-6 pb-20 md:grid-cols-2 lg:grid-cols-4">
          {display.map((plan, i) => {
            const highlighted = plan.id === "PRO";
            const isStarter = plan.id === "STARTER";
            return (
              <Card
                key={plan.id}
                className={i === 0 ? "" : highlighted ? "border-primary shadow-lg" : ""}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    {plan.name}
                    {highlighted && (
                      <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                        Popular
                      </span>
                    )}
                    {isStarter && (
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                        Most popular free upgrade
                      </span>
                    )}
                  </CardTitle>
                  <div className="text-2xl font-bold">{plan.priceLabel}</div>
                  <p className="text-sm text-muted-foreground">{plan.blurb}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {isStarter && (
                    <p className="text-xs text-muted-foreground border-t pt-3">
                      Includes &quot;Powered by Prince&quot; branding on invoices.
                      Upgrade to Pro to remove the watermark and unlock change orders,
                      retainage, photo attachments, and PDF export.
                    </p>
                  )}
                  {plan.id === "FREE" && (
                    <p className="text-xs text-muted-foreground border-t pt-3">
                      Includes &quot;Powered by Prince&quot; branding on invoices.
                    </p>
                  )}
                  <PricingCheckout planId={plan.id} planName={plan.name} />
                </CardContent>
              </Card>
            );
          })}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
