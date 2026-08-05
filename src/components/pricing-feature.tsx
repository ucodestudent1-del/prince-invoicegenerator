"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import Link from "next/link";
import { FEATURE_LABELS } from "@/lib/plans";
import type { FeatureKey } from "@/lib/plans";
import type { SubscriptionPlan } from "@prisma/client";

export function PricingFeature({ feature, plan }: {
  feature: FeatureKey;
  plan: SubscriptionPlan;
}) {
  const label = FEATURE_LABELS[feature];

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4 text-muted-foreground" />
          {label || feature}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          This feature is not available on the <strong>{plan}</strong> plan.
          Upgrade to unlock it and many more features.
        </p>
        <Button asChild>
          <Link href="/pricing?upgrade=1">View plans</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
