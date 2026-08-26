"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getPortalSession } from "@/lib/actions/portal";
import { ArrowLeft, Download, Printer, CreditCard } from "lucide-react";

interface InvoiceDetail {
  id: string;
  number: string;
  status: string;
  total: number;
  amountPaid: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  retainageAmount: number;
  issueDate: string;
  dueDate: string | null;
  notes: string | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  customer: {
    name: string;
    email: string;
  };
}

export default function PortalInvoicePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
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

    const fetchInvoice = async () => {
      try {
        const session = await getPortalSession(token);
        if (!session) {
          router["push"]("/portal/auth");
          return;
        }

        // Fetch invoice details
        const res = await fetch(`/api/portal/invoices/${id}?token=${token}`);
        if (!res["ok"]) {
          throw new Error("Failed to load invoice.");
        }
        const data = await res["json"]();
        setInvoice(data);
      } catch (err: any) {
        setError(err["message"] || "Failed to load invoice.");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-muted-foreground">Loading invoice...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-red-600">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => router["push"]("/portal/dashboard")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invoice) return null;

  const balanceDue = invoice["total"] - invoice["amountPaid"];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => router["push"]("/portal/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Invoices
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Invoice Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Invoice {invoice["number"]}</h1>
            <p className="text-sm text-muted-foreground">Issued {formatDate(invoice["issueDate"])}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={
                invoice["status"] === "PAID"
                  ? "bg-green-100 text-green-700"
                  : invoice["status"] === "OVERDUE"
                  ? "bg-red-100 text-red-700"
                  : "bg-blue-100 text-blue-700"
              }
            >
              {invoice["status"]}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/invoices/${invoice["id"]}/pdf`} target="_blank">
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window["print"]()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          {balanceDue > 0 && (
            <Button size="sm">
              <CreditCard className="mr-2 h-4 w-4" /> Pay Now
            </Button>
          )}
        </div>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 w-8">#</th>
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Rate</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice["items"]["map"]((item, idx) => (
                  <tr key={item["id"]} className="border-b">
                    <td className="py-2 text-muted-foreground">{idx + 1}</td>
                    <td className="py-2">{item["description"]}</td>
                    <td className="py-2 text-right">{item["quantity"]}</td>
                    <td className="py-2 text-right">{formatCurrency(item["unitPrice"])}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(item["amount"])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end">
              <div className="w-72 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(invoice["subtotal"])}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({invoice["taxRate"]}%)</span>
                  <span>{formatCurrency(invoice["taxAmount"])}</span>
                </div>
                {invoice["discount"] > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span>-{formatCurrency(invoice["discount"])}</span>
                  </div>
                )}
                {invoice["retainageAmount"] > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Retainage</span>
                    <span>{formatCurrency(invoice["retainageAmount"])}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(invoice["total"])}</span>
                </div>
                {invoice["amountPaid"] > 0 && (
                  <>
                    <div className="flex justify-between text-green-600">
                      <span>Amount Paid</span>
                      <span>-{formatCurrency(invoice["amountPaid"])}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Balance Due</span>
                      <span>{formatCurrency(balanceDue)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {invoice["notes"] && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice["notes"]}</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
