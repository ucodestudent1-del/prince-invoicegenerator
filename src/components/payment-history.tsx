"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusVariant: Record<string, any> = {
  PENDING: "secondary",
  COMPLETED: "success",
  FAILED: "destructive",
  REFUNDED: "outline",
};

export function PaymentHistory({
  invoiceId,
  currency,
}: {
  invoiceId: string;
  currency: string;
}) {
  const [payments, setPayments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/payments`);
        if (res.ok) {
          const data = await res.json();
          setPayments(data);
        }
      } catch (err) {
        console.error("Failed to load payments", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [invoiceId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment history</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment history</CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-b pb-2 last:border-0"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatCurrency(p.amount, currency)}</span>
                    <Badge variant={statusVariant[p.status] ?? "secondary"}>{p.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.method} · {formatDate(p.createdAt)}
                    {p.note && <span className="ml-2">— {p.note}</span>}
                  </div>
                  {(p.stripePaymentId || p.paypalTransactionId) && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.stripePaymentId && <span>Stripe ID: {p.stripePaymentId}</span>}
                      {p.paypalTransactionId && <span>PayPal Txn: {p.paypalTransactionId}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
