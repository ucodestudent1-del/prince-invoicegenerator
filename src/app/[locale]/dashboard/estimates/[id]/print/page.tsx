import { requireUser, getActivePlan, isMissingColumnError } from "@/lib/org";
import { hasFeature } from "@/lib/plans";
import { db } from "@/lib/db";
import { DocumentTemplate } from "@/components/document-template";
import { PrintButton } from "@/components/print-button";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logServerError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function EstimatePrintPage({
  params,
}: {
  params: { id: string; locale: string };
}) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const plan = await getActivePlan(user);
  const canPdfExport = hasFeature(plan, "pdfExport");

  let estimate;
  let org;
  try {
    [estimate, org] = await Promise["all"]([
      db["estimate"]["findFirst"]({
        where: { id: params["id"], orgId: user["organizationId"] },
        include: {
          customer: true,
          project: true,
          items: { orderBy: { sortOrder: "asc" } },
          linkedInvoice: { select: { id: true, number: true, status: true, total: true } },
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
          logoUrl: true,
        },
      }),
    ]);
  } catch (err) {
    if (isMissingColumnError(err)) {
      [estimate, org] = await Promise["all"]([
        db["estimate"]["findFirst"]({
          where: { id: params["id"], orgId: user["organizationId"] },
          select: {
            id: true,
            number: true,
            status: true,
            issueDate: true,
            validUntil: true,
            currency: true,
            subtotal: true,
            taxRate: true,
            taxAmount: true,
            discount: true,
            total: true,
            notes: true,
            customerId: true,
            projectId: true,
            createdAt: true,
            updatedAt: true,
            customer: { select: { id: true, name: true, company: true, email: true, address: true } },
            project: { select: { id: true, name: true } },
            items: { orderBy: { sortOrder: "asc" } },
            linkedInvoice: { select: { id: true, number: true, status: true, total: true } },
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
            logoUrl: true,
          },
        }),
      ]);
    } else {
      logServerError("EstimatePrintPage", err);
      throw err;
    }
  }

  if (!estimate) return null;
  const orgWith = { ...(org ?? {}), canPdfExport };

  return (
    <div className="invoice-print-container mx-auto max-w-3xl bg-white p-10 text-black">
      <DocumentTemplate entityType="estimates" doc={estimate} org={orgWith} />
      <div className="mt-10 flex items-center gap-3">
        <PrintButton />
        <Button asChild variant="outline" size="sm">
          <a
            href={`/api/documents/estimates/${estimate["id"]}/pdf`}
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
