"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { SubscriptionPlan } from "@prisma/client";

export function PricingCheckout({
  planId,
  planName,
}: {
  planId: SubscriptionPlan;
  planName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      if (res.status === 401 || res.status === 400) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(false);
    }
  }

  if (planId === "FREE") {
    return (
      <Button asChild className="w-full" variant="outline">
        <a href="/login">Start for free</a>
      </Button>
    );
  }

  return (
    <Button className="w-full" onClick={handleCheckout} disabled={loading}>
      {loading ? "Redirecting…" : `Choose ${planName}`}
    </Button>
  );
}
