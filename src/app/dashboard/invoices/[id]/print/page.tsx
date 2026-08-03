import { notFound } from "next/navigation";
import { requireUser } from "@/lib/org";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PrintButton } from "@/components/print-button";
import { logServerError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function InvoicePrintPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  if (!user.organizationId) return null;

  let invoice;
  try {
    invoice = await db.invoice.findFirst({
      where: { id: params.id, orgId: user.organizationId },
      include: { customer: true, project: true, items: { orderBy: { sortOrder: "asc" } } },
    });
  } catch (err) {
    logServerError("InvoicePrintPage", err);
    throw err;
  }
  if (!invoice) notFound();

  return (
    <div className="mx-auto max-w-3xl bg-white p-10 text-black">
      <div className="mb-8 flex items-start justify-between border-b pb-6">
        <div className="flex items-start gap-4">
          {invoice.logoUrl && (
            <img src={invoice.logoUrl} alt="Invoice logo" className="h-16 w-auto object-contain" />
          )}
          <div>
            <p className="text-lg font-semibold text-orange-600">Prince</p>
            <p className="text-xs text-gray-500">Construction Invoicing</p>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gray-600">
            Invoice
          </span>
          <h2 className="text-2xl font-bold mt-2">{invoice.number}</h2>
          <p className="text-sm text-gray-500 mt-1">Issued {formatDate(invoice.issueDate)}</p>
          <p className="text-sm text-gray-500">Due {formatDate(invoice.dueDate)}</p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-8 text-sm">
        <div>
          <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">Bill To</p>
          {invoice.billToAddress ? (
            <div className="whitespace-pre-line">{invoice.billToAddress}</div>
          ) : (
            <>
              <p className="font-medium">{invoice.customer?.name ?? "Unknown"}</p>
              {invoice.customer?.company && <p>{invoice.customer.company}</p>}
              {invoice.customer?.email && <p>{invoice.customer.email}</p>}
              {invoice.customer?.address && <p>{invoice.customer.address}</p>}
            </>
          )}
          {invoice.shipToAddress && (
            <div className="mt-4 pt-4 border-t">
              <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">Ship To</p>
              <div className="whitespace-pre-line">{invoice.shipToAddress}</div>
            </div>
          )}
        </div>
        <div>
          {invoice.project && (
            <div className="mb-4">
              <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">Project</p>
              <p>{invoice.project.name}</p>
            </div>
          )}
          <div>
            <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">Type</p>
            <p>{invoice.type}</p>
          </div>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-300 text-left">
            <th className="py-2 w-8">#</th>
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Unit Price</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, idx) => (
            <tr key={it.id} className="border-b border-gray-100">
              <td className="py-2 text-gray-400">{idx + 1}</td>
              <td className="py-2">{it.description}</td>
              <td className="py-2 text-right">{it.quantity}</td>
              <td className="py-2 text-right">
                {formatCurrency(it.unitPrice, invoice.currency)}
              </td>
              <td className="py-2 text-right font-medium">
                {formatCurrency(it.amount, invoice.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-72 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Tax</span>
            <span>{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Discount</span>
              <span>-{formatCurrency(invoice.discount, invoice.currency)}</span>
            </div>
          )}
          {invoice.retainageAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Retainage</span>
              <span>{formatCurrency(invoice.retainageAmount, invoice.currency)}</span>
            </div>
          )}
          <div className="border-t-2 border-gray-300 pt-1 mt-1 flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(invoice.total, invoice.currency)}</span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="mt-8 text-sm">
          <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">Notes</p>
          <p className="text-gray-600 whitespace-pre-line">{invoice.notes}</p>
        </div>
      )}

      <div className="mt-10">
        <PrintButton />
      </div>
    </div>
  );
}

