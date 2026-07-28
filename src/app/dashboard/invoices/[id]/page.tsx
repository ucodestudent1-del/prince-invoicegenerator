import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/org";
import { db } from "@/lib/db";
import { markInvoicePaid, deleteInvoice } from "@/lib/actions/invoices";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Printer, Check, Trash2 } from "lucide-react";

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  if (!user.organizationId) return null;

  const invoice = await db.invoice.findFirst({
    where: { id: params.id, orgId: user.organizationId },
    include: { customer: true, project: true, items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice) notFound();

  const statusVariant: Record<string, any> = {
    DRAFT: "secondary",
    SENT: "default",
    PAID: "success",
    OVERDUE: "destructive",
    VOID: "outline",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/invoices">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/dashboard/invoices/${invoice.id}/print`} target="_blank">
              <Printer className="mr-2 h-4 w-4" /> Export PDF
            </Link>
          </Button>
          {invoice.status !== "PAID" && (
            <form
              action={async () => {
                "use server";
                await markInvoicePaid(invoice.id);
              }}
            >
              <Button type="submit" size="sm">
                <Check className="mr-2 h-4 w-4" /> Mark paid
              </Button>
            </form>
          )}
          <form
            action={async () => {
              "use server";
              await deleteInvoice(invoice.id);
            }}
          >
            <Button type="submit" size="sm" variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </form>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {invoice.logoUrl && (
                <img
                  src={invoice.logoUrl}
                  alt="Invoice logo"
                  className="h-12 w-auto object-contain"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">{invoice.number}</h1>
                <p className="text-sm text-muted-foreground">
                  {invoice.type} • Issued {formatDate(invoice.issueDate)}
                </p>
              </div>
            </div>
            <Badge variant={statusVariant[invoice.status] ?? "secondary"}>
              {invoice.status}
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 text-sm">
            <div>
              <p className="font-medium">Bill to</p>
              <p>{invoice.customer.name}</p>
              {invoice.customer.company && <p>{invoice.customer.company}</p>}
              {invoice.customer.address && <p>{invoice.customer.address}</p>}
            </div>
            <div>
              <p className="font-medium">Due date</p>
              <p>{formatDate(invoice.dueDate)}</p>
            </div>
            <div>
              <p className="font-medium">Project</p>
              <p>{invoice.project?.name ?? "—"}</p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unit price</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it) => (
                <tr key={it.id} className="border-b">
                  <td className="py-2">{it.description}</td>
                  <td className="py-2 text-right">{it.quantity}</td>
                  <td className="py-2 text-right">
                    {formatCurrency(it.unitPrice, invoice.currency)}
                  </td>
                  <td className="py-2 text-right">
                    {formatCurrency(it.amount, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-{formatCurrency(invoice.discount, invoice.currency)}</span>
                </div>
              )}
              {invoice.retainageAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Retainage</span>
                  <span>{formatCurrency(invoice.retainageAmount, invoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 text-base font-bold">
                <span>Total</span>
                <span>{formatCurrency(invoice.total, invoice.currency)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Notes</p>
              <p>{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
