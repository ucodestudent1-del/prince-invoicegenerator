"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getPortalSession, revokePortalSession, getPortalDashboard } from "@/lib/actions/portal";
import { DollarSign, FileText, LogOut, CreditCard, ExternalLink } from "lucide-react";

interface DashboardData {
  customer: {
    id: string;
    name: string;
    email: string;
    outstandingBalance: number;
    totalInvoiced: number;
    totalPaid: number;
  };
  invoices: Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    amountPaid: number;
    issueDate: string;
    dueDate: string | null;
  }>;
  payments: Array<{
    id: string;
    amount: string;
    method: string;
    status: string;
    createdAt: string;
    invoice?: { number: string };
  }>;
}

export default function PortalDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = document["cookie"]
      ["split"]("; ")
      ["find"]((row) => row["startsWith"]("portal_token="))?.["split"]("=")[1];

    if (!token) {
      router["push"]("/portal/auth");
      return;
    }

    const fetchData = async () => {
      try {
        const session = await getPortalSession(token);
        if (!session) {
          router["push"]("/portal/auth");
          return;
        }

        const dashboard = await getPortalDashboard(token);
        setData(dashboard as any);
      } catch (err: any) {
        setError(err["message"] || "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleLogout = async () => {
    const token = document["cookie"]
      ["split"]("; ")
      ["find"]((row) => row["startsWith"]("portal_token="))?.["split"]("=")[1];

    if (token) {
      await revokePortalSession(token);
    }

    // Clear cookie
    document["cookie"] = "portal_token=; path=/; max-age=0";
    router["push"]("/portal/auth");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      PAID: "bg-green-100 text-green-700",
      SENT: "bg-blue-100 text-blue-700",
      OVERDUE: "bg-red-100 text-red-700",
      DRAFT: "bg-gray-100 text-gray-700",
      DUE: "bg-yellow-100 text-yellow-700",
    };
    return variants[status] || "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-muted-foreground">Loading your account...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-red-600">{error}</p>
            <Button asChild variant="outline" className="mt-4">
              <a href="/portal/auth">Sign In Again</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { customer, invoices, payments } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{customer["name"]}</h1>
            <p className="text-sm text-muted-foreground">{customer["email"]}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Financial Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Total Invoiced
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(customer["totalInvoiced"])}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Total Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(customer["totalPaid"])}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${customer["outstandingBalance"] > 0 ? "text-orange-600" : ""}`}>
                {formatCurrency(customer["outstandingBalance"])}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Invoices</CardTitle>
            <CardDescription>Your recent billing history</CardDescription>
          </CardHeader>
          <CardContent>
            {invoices["length"] === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <div className="space-y-2">
                {invoices["slice"](0, 10)["map"]((invoice) => (
                  <div
                    key={invoice["id"]}
                    className="flex items-center justify-between p-3 rounded-md border hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-sm">{invoice["number"]}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(invoice["issueDate"])} • Due {formatDate(invoice["dueDate"])}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusBadge(invoice["status"])}>{invoice["status"]}</Badge>
                      <span className="font-medium text-sm">{formatCurrency(invoice["total"])}</span>
                      <Button asChild variant="ghost" size="sm">
                        <a href={`/portal/invoices/${invoice["id"]}`}>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment History</CardTitle>
            <CardDescription>Your recent payments</CardDescription>
          </CardHeader>
          <CardContent>
            {payments["length"] === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <div className="space-y-2">
                {payments["slice"](0, 10)["map"]((payment) => (
                  <div
                    key={payment["id"]}
                    className="flex items-center justify-between p-3 rounded-md border"
                  >
                    <div>
                      <p className="font-medium text-sm">{payment["invoice"]?.["number"] || "Payment"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(payment["createdAt"])} • {payment["method"]}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-100 text-green-700">{payment["status"]}</Badge>
                      <span className="font-medium text-sm">{formatCurrency(Number(payment["amount"]))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
