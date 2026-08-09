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
  const [error, setError] = React.useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      
      if (res.status === 401 || res.status === 400) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        setError(data.error || "Checkout failed. Please try again.");
        return;
      }
      
      if (res.status === 429) {
        setError("Too many requests. Please wait a moment and try again.");
        return;
      }
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Checkout failed (${res.status})`);
        return;
      }
      
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("No checkout URL returned. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
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
    <div className="w-full space-y-2">
      <Button className="w-full" onClick={handleCheckout} disabled={loading}>
        {loading ? "Redirecting…" : `Choose ${planName}`}
      </Button>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
