"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Eye, Send } from "lucide-react";
import Link from "next/link";

interface Invoice {
  id: string;
  number: string;
  status: string;
  total: number;
  amountPaid: number;
  issueDate: any;
  dueDate: string | null | any;
  currency: string;
  payments: any[];
}

interface Estimate {
  id: string;
  number: string;
  status?: string;
  total?: number;
  createdAt?: any;
}

interface ClientDetailViewProps {
  customerId: string;
  invoices?: Invoice[];
  estimates?: Estimate[];
}

const statusVariant: Record<string, any> = {
  DRAFT: "secondary",
  PENDING_REVIEW: "outline",
  APPROVED: "secondary",
  SENT: "default",
  PAID: "success",
  UNPAID: "outline",
  OVERDUE: "destructive",
  VOID: "outline",
};

export function ClientDetailView({ customerId, invoices = [], estimates = [] }: ClientDetailViewProps) {
  const [activeTab, setActiveTab] = useState<"invoices" | "estimates" | "payments" | "activity">("invoices");

  const tabs = [
    { key: "invoices", label: "Invoices" },
    { key: "estimates", label: "Estimates" },
    { key: "payments", label: "Payments" },
    { key: "activity", label: "Activity" },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        {tabs["map"]((tab) => (
          <button
            key={tab["key"]}
            onClick={() => setActiveTab(tab["key"])}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab["key"]
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab["label"]}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "invoices" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices["length"] === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No invoices for this customer yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {invoices["map"]((inv) => {
                    const balance = inv["total"] - inv["amountPaid"];
                    return (
                      <div key={inv["id"]} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/dashboard/invoices/${inv["id"]}`}
                            className="font-medium hover:underline"
                          >
                            {inv["number"]}
                          </Link>
                          <Badge variant={statusVariant[inv["status"]] ?? "secondary"}>
                            {inv["status"]}
                          </Badge>
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-medium">{formatCurrency(inv["total"], inv["currency"])}</div>
                          {balance > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Balance: {formatCurrency(balance, inv["currency"])}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "estimates" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estimates</CardTitle>
            </CardHeader>
            <CardContent>
              {estimates["length"] === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No estimates for this customer yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {estimates["map"]((est) => (
                    <div key={est["id"]} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/dashboard/estimates/${est["id"]}`}
                          className="font-medium hover:underline"
                        >
                          {est["number"]}
                        </Link>
                        <Badge variant="outline">{est["status"]}</Badge>
                      </div>
                      <div className="text-right text-sm font-medium">
                          {est["total"] !== undefined && formatCurrency(est["total"])}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "payments" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices["filter"]((inv) => inv["payments"]?.["length"] > 0)["length"] === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No payment history for this customer yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {invoices
                    ["filter"]((inv) => inv["payments"]?.["length"] > 0)
                    ["map"]((inv) =>
                      inv["payments"]["map"]((payment: any) => (
                        <div key={payment["id"]} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <Link
                              href={`/dashboard/invoices/${inv["id"]}`}
                              className="font-medium hover:underline text-sm"
                            >
                              {inv["number"]}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(payment["createdAt"])}
                            </p>
                          </div>
                          <div className="text-right text-sm font-medium">
                            {formatCurrency(payment["amount"], inv["currency"])}
                          </div>
                        </div>
                      ))
                    )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "activity" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Client activity and communication history will be displayed here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}