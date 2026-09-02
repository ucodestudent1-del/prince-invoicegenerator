import { requireUser, getActivePlan, isMissingColumnError } from "@/lib/org";
import { hasFeature } from "@/lib/plans";
import { db } from "@/lib/db";
import { DocumentTemplate } from "@/components/document-template";
import { PrintButton } from "@/components/print-button";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logServerError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function ChangeOrderPrintPage({
  params,
}: {
  params: { id: string; locale: string };
}) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const plan = await getActivePlan(user);
  const canPdfExport = hasFeature(plan, "pdfExport");

  let changeOrder;
  let org;
  try {
    [changeOrder, org] = await Promise["all"]([
       db["changeOrder"]["findFirst"]({
         where: { id: params["id"], orgId: user["organizationId"] },
         include: {
           project: true,
           customer: true,
           invoice: { select: { id: true, number: true, status: true, total: true } },
         },
       }),
      db["organization"]["findUnique"]({
        where: { id: user["organizationId"] },
        select: {
          id: true,
          name: true,
          plan: true,
          brandColor: true,
          accentColor: true,
          fontFamily: true,
          template: true,
          layout: true,
          currency: true,
        },
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
          where: { id: user["organizationId"] },
          select: {
            id: true,
            name: true,
            plan: true,
            brandColor: true,
            accentColor: true,
            fontFamily: true,
            template: true,
            layout: true,
            currency: true,
          },
        }),
      ]);
    } else {
      logServerError("ChangeOrderPrintPage", err);
      throw err;
    }
  }

  if (!changeOrder) return null;
  const orgWith = { ...(org ?? {}), canPdfExport };

  return (
    <div className="invoice-print-container mx-auto max-w-3xl bg-white p-10 text-black">
      <DocumentTemplate entityType="change-orders" doc={changeOrder} org={orgWith} />
      <div className="mt-10 flex items-center gap-3">
        <PrintButton />
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
  );
}
