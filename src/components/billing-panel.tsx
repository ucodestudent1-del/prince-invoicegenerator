"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function BillingPanel({
  plan,
  status,
  renewalDate,
}: {
  plan: string;
  status: string | null;
  renewalDate: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function openPortal() {
    setLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Billing</h1>
        <Button asChild variant="outline" onClick={() => router.push("/pricing")}>
          <span>Change plan</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Plan:</span>
            <Badge>{plan}</Badge>
            {status && (
              <Badge variant="secondary">{status}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Renews:</span>
            <span>{renewalDate ?? "—"}</span>
          </div>
          {plan !== "FREE" && (
            <Button onClick={openPortal} disabled={loading} variant="outline">
              {loading ? "Opening…" : "Manage billing & payment method"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
