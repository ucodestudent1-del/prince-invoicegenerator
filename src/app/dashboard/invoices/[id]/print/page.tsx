import { notFound } from "next/navigation";
import { requireUser } from "@/lib/org";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InvoicePrintPage({
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

  return (
    <div className="mx-auto max-w-3xl bg-white p-10 text-black">
      <div className="mb-8 flex items-start justify-between">
        <div className="flex items-start gap-4">
          {invoice.logoUrl && (
            <img
              src={invoice.logoUrl}
              alt="Invoice logo"
              className="h-16 object-contain"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold text-orange-600">Prince</h1>
            <p className="text-sm text-gray-500">Construction Invoicing</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold">{invoice.number}</h2>
          <p className="text-sm text-gray-500">
            {invoice.type} • {formatDate(invoice.issueDate)}
          </p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="font-semibold">Bill To</p>
          <p>{invoice.customer.name}</p>
          {invoice.customer.company && <p>{invoice.customer.company}</p>}
          {invoice.customer.address && <p>{invoice.customer.address}</p>}
        </div>
        <div>
          <p className="font-semibold">Due Date</p>
          <p>{formatDate(invoice.dueDate)}</p>
        </div>
        <div>
          <p className="font-semibold">Project</p>
          <p>{invoice.project?.name ?? "—"}</p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-300 text-left">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Unit Price</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it) => (
            <tr key={it.id} className="border-b border-gray-200">
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

      <div className="mt-4 flex justify-end">
        <div className="w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-{formatCurrency(invoice.discount, invoice.currency)}</span>
            </div>
          )}
          {invoice.retainageAmount > 0 && (
            <div className="flex justify-between">
              <span>Retainage</span>
              <span>{formatCurrency(invoice.retainageAmount, invoice.currency)}</span>
            </div>
          )}
          <div className="flex justify-between border-t-2 border-gray-300 pt-1 text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(invoice.total, invoice.currency)}</span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="mt-8 text-sm">
          <p className="font-semibold">Notes</p>
          <p className="text-gray-600">{invoice.notes}</p>
        </div>
      )}

      <div className="mt-10 hidden print:block">
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
        </Button>
      </div>

      <style>{`@media print { .no-print { display: none } }`}</style>
      <script
        dangerouslySetInnerHTML={{
          __html: "window.onload = function(){ if(window.location.search.indexOf('auto')>-1) window.print(); }",
        }}
      />
    </div>
  );
}
