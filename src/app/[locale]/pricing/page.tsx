import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS, FEATURE_LABELS, type FeatureKey } from "@/lib/plans";
import { PricingCheckout } from "@/components/pricing-checkout";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
	title: "Pricing",
	description:
		"Simple, transparent pricing for Prince. Start free and upgrade as your crew grows.",
	alternates: { canonical: "/pricing" },
};

const display = PLANS["map"]((p) => ({
  id: p["id"],
  name: p["name"],
  priceLabel: p["priceLabel"],
  blurb: p["blurb"],
  features: p["features"]["map"]((f) => FEATURE_LABELS[f as FeatureKey]),
}));

export default async function PricingPage() {
  const t = await getTranslations("pricing");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="container py-16 text-center md:py-24">
          <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            {t("subtitle")}
          </p>
        </section>

        <section className="container grid gap-6 pb-20 md:grid-cols-2 lg:grid-cols-4">
          {display["map"]((plan) => {
            const highlighted = plan["id"] === "PRO";
            return (
              <Card
                key={plan["id"]}
                className={highlighted ? "border-primary" : ""}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    {plan["name"]}
                    {highlighted && (
                      <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                        {t("popular")}
                      </span>
                    )}
                  </CardTitle>
                  <div className="text-2xl font-bold">{plan["priceLabel"]}</div>
                  <p className="text-sm text-muted-foreground">{plan["blurb"]}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {plan["features"]["map"]((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {plan["id"] === "FREE" && (
                    <p className="border-t pt-3 text-xs text-muted-foreground">
                      {t("upgradeToRemove")}
                    </p>
                  )}
                  <PricingCheckout planId={plan["id"]} planName={plan["name"]} />
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
