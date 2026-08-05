"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

export function PaymentLinks({
  invoiceId,
  invoiceStatus,
}: {
  invoiceId: string;
  invoiceStatus: string;
}) {
  const [links, setLinks] = React.useState<{ stripe?: string; paypal?: string }>({});
  const [loading, setLoading] = React.useState<string | null>(null);

  if (invoiceStatus === "PAID" || invoiceStatus === "VOID") {
    return null;
  }

  async function generateLink(gateway: "stripe" | "paypal") {
    setLoading(gateway);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to create payment link.");
        return;
      }
      const data = await res.json();
      setLinks((prev) => ({ ...prev, [gateway]: data.url }));
    } catch (err) {
      alert("Failed to create payment link.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment links</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateLink("stripe")}
            disabled={loading === "stripe"}
          >
            {loading === "stripe" ? "Generating…" : "Generate Stripe link"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateLink("paypal")}
            disabled={loading === "paypal"}
          >
            {loading === "paypal" ? "Generating…" : "Generate PayPal link"}
          </Button>
        </div>
        {links.stripe && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium mb-1">Stripe payment link</p>
            <a
              href={links.stripe}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline break-all"
            >
              {links.stripe}
            </a>
            <Button asChild variant="ghost" size="sm" className="mt-2">
              <a href={links.stripe} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Open
              </a>
            </Button>
          </div>
        )}
        {links.paypal && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium mb-1">PayPal payment link</p>
            <a
              href={links.paypal}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline break-all"
            >
              {links.paypal}
            </a>
            <Button asChild variant="ghost" size="sm" className="mt-2">
              <a href={links.paypal} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Open
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
