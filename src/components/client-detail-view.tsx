"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Eye, Send } from "lucide-react";

interface Invoice {
  id: string;
  number: string;
  status: string;
  total: number;
  amountPaid: number;
  issueDate: string;
  dueDate: string | null;
  payments: any[];
}

interface Estimate {
  id: string;
  number: string;
  status: string;
  total: number;
  createdAt: string;
}

interface ClientDetailViewProps {
  customerId: string;
}

export function ClientDetailView({ customerId }: ClientDetailViewProps) {
  const [activeTab, setActiveTab] = useState<"invoices" | "estimates" | "payments" | "activity">("invoices");

  // In a real implementation, these would be fetched from the server
  // For now, we'll show placeholder content
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
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
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
              <p className="text-sm text-muted-foreground">
                Invoice list will be displayed here. Server data should be passed as props or fetched client-side.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === "estimates" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estimates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Estimate list will be displayed here.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === "payments" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Payment history will be displayed here.
              </p>
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
