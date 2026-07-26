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
  const [interval, setInterval] = React.useState<"monthly" | "yearly">("monthly");

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, interval }),
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
    <div className="space-y-2">
      <div className="flex rounded-md border p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setInterval("monthly")}
          className={`flex-1 rounded px-2 py-1 ${
            interval === "monthly" ? "bg-primary text-primary-foreground" : ""
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setInterval("yearly")}
          className={`flex-1 rounded px-2 py-1 ${
            interval === "yearly" ? "bg-primary text-primary-foreground" : ""
          }`}
        >
          Yearly
        </button>
      </div>
      <Button className="w-full" onClick={handleCheckout} disabled={loading}>
        {loading ? "Redirecting…" : `Choose ${planName}`}
      </Button>
    </div>
  );
}
