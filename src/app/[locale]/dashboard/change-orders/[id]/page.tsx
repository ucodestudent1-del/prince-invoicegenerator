import { Link, redirect } from "@/i18n/navigation";
import { requireUser, requireFeature, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { logServerError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function ChangeOrderDetailPage({
  params,
}: {
  params: { id: string; locale: string };
}) {
  await requireFeature("changeOrders");
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;

  let changeOrder;
  let org;
  try {
    [changeOrder, org] = await Promise["all"]([
      db["changeOrder"]["findFirst"]({
        where: { id: params["id"], orgId: user["organizationId"] },
        include: {
          project: true,
          invoice: { select: { id: true, number: true, status: true, total: true } },
        },
      }),
      db["organization"]["findUnique"]({
        where: { id: user["organizationId"] },
        select: { id: true, name: true },
      }),
    ]);
  } catch (err) {
    if (isMissingColumnError(err)) {
      [changeOrder, org] = await Promise["all"]([
        db["changeOrder"]["findFirst"]({
          where: { id: params["id"], orgId: user["organizationId"] },
          select: {
            id: true,
            number: true,
            title: true,
            description: true,
            amount: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            projectId: true,
            invoiceId: true,
            project: { select: { id: true, name: true } },
            invoice: { select: { id: true, number: true, status: true, total: true } },
          },
        }),
        db["organization"]["findUnique"]({
          where: { id: user["organizationId"] },
          select: { id: true, name: true },
        }),
      ]);
    } else {
      logServerError("ChangeOrderDetailPage", err);
      throw err;
    }
  }

  if (!changeOrder) {
    redirect({ href: "/dashboard/change-orders", locale: params["locale"] });
    throw new Error("Unreachable: redirect should have exited");
  }

  const amount = Number(changeOrder["amount"] ?? 0);

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/change-orders">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/dashboard/change-orders/${changeOrder["id"]}/print`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Printer className="mr-2 h-4 w-4" /> Export PDF
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={`/api/documents/change-orders/${changeOrder["id"]}/pdf`}
              target="_blank"
              download
              rel="noopener noreferrer"
            >
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </a>
          </Button>
        </div>
      </div>

      {/* On-screen preview — matches the PDF template layout. */}
      <div className="bg-white border border-gray-200 rounded-md p-6 sm:p-10 shadow-sm co-body">
        {/* Title */}
        <div className="co-title">
          <h1>Change Order</h1>
          <div className="co-number">
            <span>No. {changeOrder["number"]}</span>
            {" · "}
            <span className="co-status" data-status={changeOrder["status"]}>
              {changeOrder["status"]}
            </span>
          </div>
        </div>

        {/* Reference */}
        <section className="co-section">
          <h2 className="co-section-title">Reference</h2>
          <div className="co-meta">
            <div className="co-meta-item">
              <span className="co-meta-label">Date</span>
              <span className="co-meta-value">{formatDate(changeOrder["createdAt"])}</span>
            </div>
            <div className="co-meta-item">
              <span className="co-meta-label">Effective</span>
              <span className="co-meta-value">{formatDate(changeOrder["createdAt"])}</span>
            </div>
            <div className="co-meta-item">
              <span className="co-meta-label">Linked Invoice</span>
              <span className="co-meta-value">
                {changeOrder["invoice"] ? `#${changeOrder["invoice"]["number"]}` : "—"}
              </span>
            </div>
          </div>
        </section>

        {/* Parties */}
        <section className="co-section">
          <h2 className="co-section-title">Parties</h2>
          <div className="co-parties">
            <div className="co-party">
              <div className="co-party-label">Contractor</div>
              <div className="co-party-line">
                <strong>{org?.["name"] ?? "—"}</strong>
              </div>
            </div>
            <div className="co-party">
              <div className="co-party-label">Owner</div>
              <div className="co-party-line">—</div>
            </div>
          </div>
        </section>

        {/* Project */}
        <section className="co-section">
          <h2 className="co-section-title">Project</h2>
          <div className="co-project">
            <div className="co-meta-item">
              <span className="co-meta-label">Project Name</span>
              <span className="co-meta-value">{changeOrder["project"]?.["name"] ?? "—"}</span>
            </div>
            <div className="co-meta-item">
              <span className="co-meta-label">Project #</span>
              <span className="co-meta-value">{changeOrder["projectId"] ?? "—"}</span>
            </div>
          </div>
        </section>

        {/* Description */}
        {changeOrder["description"] && (
          <section className="co-section">
            <h2 className="co-section-title">Description of Change</h2>
            <p className="co-narrative">{changeOrder["description"]}</p>
          </section>
        )}

        {/* Schedule impact (no data yet, but the strip is always rendered
            so the on-screen preview matches the printed PDF). */}
        <section className="co-section">
          <h2 className="co-section-title">Schedule Impact</h2>
          <div className="co-schedule">
            <div className="co-meta-item">
              <span className="co-meta-label">Days Added</span>
              <span className="co-meta-value">—</span>
            </div>
            <div className="co-meta-item">
              <span className="co-meta-label">New Completion</span>
              <span className="co-meta-value">—</span>
            </div>
            <div className="co-meta-item">
              <span className="co-meta-label">Original Completion</span>
              <span className="co-meta-value">—</span>
            </div>
          </div>
        </section>

        {/* Cost impact */}
        <section className="co-section">
          <h2 className="co-section-title">Cost Impact</h2>
          <table className="co-cost-table">
            <colgroup>
              <col className="co-col-num" />
              <col className="co-col-desc" />
              <col className="co-col-qty" />
              <col className="co-col-unit" />
              <col className="co-col-amount" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Item</th>
                <th scope="col" className="num">Qty</th>
                <th scope="col" className="num">Unit Price</th>
                <th scope="col" className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="co-col-num">1</td>
                <td>{changeOrder["title"]}</td>
                <td className="num">1</td>
                <td className="num">{formatCurrency(amount)}</td>
                <td className="num">{formatCurrency(amount)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="grand-total">
                <th scope="row" colSpan={4} className="label">
                  Total Change
                </th>
                <td className="num">{formatCurrency(amount)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* Terms */}
        <section className="co-section">
          <h2 className="co-section-title">Terms</h2>
          <p className="co-terms">
            The work described above shall be performed at the price stated and, upon
            acceptance, incorporated into the original contract. The contract
            completion date is adjusted as shown in the Schedule Impact. This
            change order becomes binding when signed by both parties below; payment
            terms remain as originally agreed unless otherwise noted.
          </p>
        </section>

        {/* Signatures */}
        <section className="co-signatures" aria-label="Signatures">
          <div className="co-signature">
            <span className="co-sig-role">Contractor</span>
            <div className="co-sig-line" />
            <span className="co-sig-line-name">Signature · Date</span>
            <div className="co-sig-line" style={{ marginTop: "0.5rem" }} />
            <span className="co-sig-line-name">Printed Name</span>
          </div>
          <div className="co-signature">
            <span className="co-sig-role">Owner / Authorized Representative</span>
            <div className="co-sig-line" />
            <span className="co-sig-line-name">Signature · Date</span>
            <div className="co-sig-line" style={{ marginTop: "0.5rem" }} />
            <span className="co-sig-line-name">Printed Name</span>
          </div>
        </section>
      </div>
    </div>
  );
}
