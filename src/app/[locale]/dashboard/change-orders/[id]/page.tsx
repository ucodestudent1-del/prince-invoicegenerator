import { Link, redirect } from "@/i18n/navigation";
import { requireUser, requireFeature, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function ChangeOrderDetailPage({
  params,
}: {
  params: { id: string; locale: string };
}) {
  await requireFeature("changeOrders");
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];
  const t = await getTranslations("changeOrders");

   let changeOrder;
  let org;
  let customer;
  try {
    [changeOrder, org] = await Promise["all"]([
      db["changeOrder"]["findFirst"]({
        where: { id: params["id"], orgId },
        include: {
          project: true,
          customer: true,
          invoice: { select: { id: true, number: true, status: true, total: true } },
        },
      }),
      db["organization"]["findUnique"]({
        where: { id: orgId },
        select: { id: true, name: true },
      }),
    ]);
  } catch (err) {
    if (isMissingColumnError(err)) {
      [changeOrder, org] = await Promise["all"]([
        db["changeOrder"]["findFirst"]({
          where: { id: params["id"], orgId },
          select: {
            id: true,
            number: true,
            title: true,
            description: true,
            amount: true,
            changeAmount: true,
            originalTotal: true,
            revisedTotal: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            issueDate: true,
            projectId: true,
            invoiceId: true,
            customerId: true,
            customer: true,
            billToAddress: true,
            daysAdded: true,
            originalCompletionDate: true,
            newCompletionDate: true,
            scopeChangeDescription: true,
            scheduleImpactDescription: true,
            project: { select: { id: true, name: true, number: true } },
            invoice: { select: { id: true, number: true, status: true, total: true } },
          },
        }),
        db["organization"]["findUnique"]({
          where: { id: orgId },
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

  const coCustomer = (changeOrder as any)["customer"] ?? customer;
  const amount = Number((changeOrder as any)["amount"] ?? 0);
  const originalTotal = Number((changeOrder as any)["originalTotal"] ?? 0);
  const changeAmount = Number((changeOrder as any)["changeAmount"] ?? amount);
  const revisedTotal = Number((changeOrder as any)["revisedTotal"] ?? originalTotal + changeAmount);
  const issueDate = (changeOrder as any)["issueDate"] ?? (changeOrder as any)["createdAt"];

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
        {/* 1. Project Information */}
        <div className="co-title">
          <h1>Change Order</h1>
          <div className="co-number">
            <span>No. {(changeOrder as any)["number"]}</span>
            {" · "}
            <span className="co-status" data-status={(changeOrder as any)["status"]}>
              {(changeOrder as any)["status"]}
            </span>
          </div>
        </div>

        <section className="co-section" aria-labelledby="co-project-info-title">
          <h2 id="co-project-info-title" className="co-section-title">
            {t("projectInformation")}
          </h2>
          <div className="co-meta">
            <div className="co-meta-item">
              <span className="co-meta-label">{t("dateOfIssue")}</span>
              <span className="co-meta-value">{formatDate(issueDate)}</span>
            </div>
            {(changeOrder as any)["project"] && (
              <>
                <div className="co-meta-item">
                  <span className="co-meta-label">Project</span>
                  <span className="co-meta-value">
                    {(changeOrder as any)["project"]?.["name"] ?? "—"}
                    {(changeOrder as any)["project"]?.["number"] ? ` #${(changeOrder as any)["project"]?.["number"]}` : ""}
                  </span>
                </div>
              </>
            )}
            {coCustomer && (
              <div className="co-meta-item">
                <span className="co-meta-label">{t("clientName")}</span>
                <span className="co-meta-value">
                  {coCustomer?.["name"] ?? coCustomer?.["company"] ?? "—"}
                </span>
              </div>
            )}
          </div>
        </section>

        {(changeOrder as any)["billToAddress"] && (
          <section className="co-section" aria-labelledby="co-location-title">
            <h2 id="co-location-title" className="co-section-title">
              {t("locationOfWork")}
            </h2>
            <p className="co-narrative" style={{ whiteSpace: "pre-line" }}>
              {(changeOrder as any)["billToAddress"]}
            </p>
          </section>
        )}

        {/* 2. Change Details */}
        {(changeOrder as any)["description"] && (
          <section className="co-section" aria-labelledby="co-desc-title">
            <h2 id="co-desc-title" className="co-section-title">
              {t("changeDescription")}
            </h2>
            <p className="co-narrative">{(changeOrder as any)["description"]}</p>
          </section>
        )}

        {(changeOrder as any)["scopeChangeDescription"] && (
          <section className="co-section" aria-labelledby="co-breakdown-title">
            <h2 id="co-breakdown-title" className="co-section-title">
              {t("costWorkBreakdown")}
            </h2>
            <p className="co-narrative">{(changeOrder as any)["scopeChangeDescription"]}</p>
          </section>
        )}

        {/* 3. Financial Impact */}
        <section className="co-section" aria-labelledby="co-financial-title">
          <h2 id="co-financial-title" className="co-section-title">
            {t("financialImpact")}
          </h2>
          <table className="co-cost-table">
            <colgroup>
              <col className="co-col-num" />
              <col className="co-col-desc" />
              <col className="co-col-qty" />
              <col className="co-col-unit" />
              <col className="co-col-amount" />
            </colgroup>
            <tbody>
              <tr>
                <td colSpan={5}>
                  <div className="co-meta">
                    <div className="co-meta-item">
                      <span className="co-meta-label">{t("originalContractPrice")}</span>
                      <span className="co-meta-value">{formatCurrency(originalTotal)}</span>
                    </div>
                    <div className="co-meta-item">
                      <span className="co-meta-label">{t("priceOfChange")}</span>
                      <span className="co-meta-value">{formatCurrency(changeAmount)}</span>
                    </div>
                    <div className="co-meta-item">
                      <span className="co-meta-label">{t("newContractPrice")}</span>
                      <span className="co-meta-value font-semibold">{formatCurrency(revisedTotal)}</span>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="grand-total">
                <th scope="row" colSpan={4} className="label">
                  {t("priceOfChange")}
                </th>
                <td className="num">{formatCurrency(changeAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* 4. Schedule Impact */}
        <section className="co-section" aria-labelledby="co-schedule-title">
          <h2 id="co-schedule-title" className="co-section-title">
            {t("scheduleImpact")}
          </h2>
          <div className="co-schedule">
            <div className="co-meta-item">
              <span className="co-meta-label">{t("originalCompletionDate")}</span>
              <span className="co-meta-value">
                {(changeOrder as any)["originalCompletionDate"]
                  ? formatDate((changeOrder as any)["originalCompletionDate"])
                  : "—"}
              </span>
            </div>
            <div className="co-meta-item">
              <span className="co-meta-label">{t("daysAdded")}</span>
              <span className="co-meta-value">
                {(changeOrder as any)["daysAdded"] != null
                  ? `+${(changeOrder as any)["daysAdded"]}`
                  : "—"}
              </span>
            </div>
            <div className="co-meta-item">
              <span className="co-meta-label">{t("newCompletionDate")}</span>
              <span className="co-meta-value">
                {(changeOrder as any)["newCompletionDate"]
                  ? formatDate((changeOrder as any)["newCompletionDate"])
                  : "—"}
              </span>
            </div>
          </div>
        </section>

        {(changeOrder as any)["scheduleImpactDescription"] && (
          <section className="co-section" aria-labelledby="co-sched-desc-title">
            <h2 id="co-sched-desc-title" className="co-section-title">
              {t("scheduleImpactDescription")}
            </h2>
            <p className="co-narrative">{(changeOrder as any)["scheduleImpactDescription"]}</p>
          </section>
        )}

        {/* Linked Invoice */}
        <section className="co-section" aria-labelledby="co-reference-title">
          <h2 id="co-reference-title" className="co-section-title">
            Reference
          </h2>
          <div className="co-meta">
            <div className="co-meta-item">
              <span className="co-meta-label">Date</span>
              <span className="co-meta-value">{formatDate(issueDate)}</span>
            </div>
            <div className="co-meta-item">
              <span className="co-meta-label">Linked Invoice</span>
              <span className="co-meta-value">
                {(changeOrder as any)["invoice"]
                  ? `#${(changeOrder as any)["invoice"]?.["number"]}`
                  : "—"}
              </span>
            </div>
          </div>
        </section>

        {/* Terms */}
        <section className="co-section" aria-labelledby="co-terms-title">
          <h2 id="co-terms-title" className="co-section-title">
            Terms
          </h2>
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
            <span className="co-sig-line-name">Signature &middot; Date</span>
            <div className="co-sig-line" style={{ marginTop: "0.5rem" }} />
            <span className="co-sig-line-name">Printed Name</span>
          </div>
          <div className="co-signature">
            <span className="co-sig-role">Owner / Authorized Representative</span>
            <div className="co-sig-line" />
            <span className="co-sig-line-name">Signature &middot; Date</span>
            <div className="co-sig-line" style={{ marginTop: "0.5rem" }} />
            <span className="co-sig-line-name">Printed Name</span>
          </div>
        </section>
      </div>
    </div>
  );
}
