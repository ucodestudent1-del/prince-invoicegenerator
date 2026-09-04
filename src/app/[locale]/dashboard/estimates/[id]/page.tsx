import { Link, redirect } from "@/i18n/navigation";
import { requireUser, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { sendEstimate, convertEstimateToInvoice, deleteEstimate } from "@/lib/actions/estimates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Printer,
  Send,
  FileText,
  ExternalLink,
  Download,
  Trash2,
} from "lucide-react";
import { EstimateAuditLog } from "@/components/estimate-audit-log";
import { CopyShareLinkButton } from "@/components/copy-share-link-button";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";

const estimateStatusVariant: Record<string, any> = {
  DRAFT: "secondary",
  SENT: "default",
  VIEWED: "outline",
  ACCEPTED: "success",
  REJECTED: "destructive",
  DECLINED: "destructive",
  EXPIRED: "outline",
  INVOICED: "default",
};

export default async function EstimateDetailPage({
  params,
}: {
  params: { id: string; locale: string };
}) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const t = await getTranslations("estimates");
  const orgId = user["organizationId"];

  let estimate: any;
  try {
    estimate = await db["estimate"]["findFirst"]({
      where: { id: params["id"], orgId },
      include: {
        customer: true,
        project: true,
        items: { orderBy: { sortOrder: "asc" } },
        linkedInvoice: { select: { id: true, number: true, status: true, total: true } },
      },
    });
  } catch (err) {
    if (isMissingColumnError(err)) {
      estimate = await db["estimate"]["findFirst"]({
        where: { id: params["id"], orgId },
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
      });
    } else {
      logServerError("EstimateDetailPage", err);
      throw err;
    }
  }

  if (!estimate) {
    redirect({ href: "/dashboard/estimates", locale: params["locale"] });
    throw new Error("Unreachable: redirect should have exited");
  }

  const isExpired =
    estimate["validUntil"] && new Date(estimate["validUntil"]) < new Date() &&
    ["SENT", "VIEWED"]["includes"](estimate["status"]);

  const canSend = estimate["status"] === "DRAFT";
  const canConvertToInvoice =
    estimate["status"] === "ACCEPTED" && !isExpired && !estimate["linkedInvoice"];
  const alreadyConverted = estimate["status"] === "INVOICED" && estimate["linkedInvoice"];

  const shareUrl = estimate["shareToken"]
    ? `${process["env"]["NEXT_PUBLIC_BASE_URL"] || "https://app.example.com"}${
      params["locale"] ? `/${params["locale"]}` : ""
    }/estimate/${estimate["number"]}?token=${estimate["shareToken"]}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/estimates">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t("back")}
          </Link>
        </Button>
        <div className="flex gap-2">
          {shareUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> {t("viewEstimate")}
              </a>
            </Button>
          )}
            {shareUrl && (
              <CopyShareLinkButton url={shareUrl} />
            )}
          {canSend && (
            <form
              action={async () => {
                "use server";
                await sendEstimate(estimate["id"], {});
              }}
            >
              <Button type="submit" size="sm">
                <Send className="mr-2 h-4 w-4" /> {t("send")}
              </Button>
            </form>
          )}
          {canConvertToInvoice && (
            <form
              action={async () => {
                "use server";
                await convertEstimateToInvoice(estimate["id"], {});
              }}
            >
              <Button type="submit" size="sm">
                <FileText className="mr-2 h-4 w-4" /> {t("convertToInvoice")}
              </Button>
            </form>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="flex items-start justify-between border-b pb-4">
            <div className="flex items-start gap-4">
              <div>
                <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {t("estimateLabel")}
                </span>
                <h1 className="text-2xl font-bold mt-1">{estimate["number"]}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("issued", { date: formatDate(estimate["issueDate"]) })}
                  {" · "}
                  {t("validUntil", { date: formatDate(estimate["validUntil"]) })}
                </p>
              </div>
            </div>
            <Badge variant={estimateStatusVariant[estimate["status"]] ?? "secondary"}>
              {estimate["status"]}
            </Badge>
          </div>

          {isExpired && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              This estimate expired on {formatDate(estimate["validUntil"])}.
            </div>
          )}

          {alreadyConverted && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              This estimate was converted to invoice{" "}
              <Link
                href={`/dashboard/invoices/${estimate["linkedInvoice"]["id"]}`}
                className="font-medium underline"
              >
                {estimate["linkedInvoice"]["number"]}
              </Link>
              .
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">
                {t("customer")}
              </p>
              <p className="font-medium">
                {estimate["customer"]?.["name"] || estimate["customer"]?.["company"] || "—"}
              </p>
              {estimate["customer"]?.["email"] && <p className="text-muted-foreground">{estimate["customer"]["email"]}</p>}
              {estimate["customer"]?.["address"] && <p className="text-muted-foreground">{estimate["customer"]["address"]}</p>}
            </div>
            {estimate["project"] && (
              <div>
                <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">
                  {t("project")}
                </p>
                <p>{estimate["project"]["name"]}</p>
              </div>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">
                {t("status")}
              </p>
              <Badge variant={estimateStatusVariant[estimate["status"]] ?? "secondary"}>
                {estimate["status"]}
              </Badge>
            </div>
            {estimate["viewedAt"] && (
              <div>
                <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">
                  Viewed
                </p>
                <p className="text-muted-foreground">{formatDate(estimate["viewedAt"])}</p>
              </div>
            )}
            {estimate["acceptedAt"] && (
              <div>
                <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">
                  Accepted
                </p>
                <p className="text-muted-foreground">{formatDate(estimate["acceptedAt"])}</p>
              </div>
            )}
          </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 w-8">#</th>
                    <th className="py-2">{t("description")}</th>
                    <th className="py-2 text-right">{t("quantity")}</th>
                    <th className="py-2 text-right">{t("unitPrice")}</th>
                    <th className="py-2 text-right">{t("amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate["items"]["map"]((item: any, idx: number) => (
                    <tr key={item["id"]} className="border-b">
                      <td className="py-2 text-gray-400">{idx + 1}</td>
                      <td className="py-2">{item["description"]}</td>
                      <td className="py-2 text-right">{item["quantity"]}</td>
                      <td className="py-2 text-right">{formatCurrency(item["unitPrice"], estimate["currency"])}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(item["amount"], estimate["currency"])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
            <div className="w-72 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span>{formatCurrency(estimate["subtotal"], estimate["currency"])}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("tax")}</span>
                <span>{formatCurrency(estimate["taxAmount"], estimate["currency"])}</span>
              </div>
              {estimate["discount"] > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("discount")}</span>
                  <span>-{formatCurrency(estimate["discount"], estimate["currency"])}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 text-base font-bold">
                <span>{t("total")}</span>
                <span>{formatCurrency(estimate["total"], estimate["currency"])}</span>
              </div>
            </div>
          </div>

          {estimate["notes"] && (
            <div className="text-sm text-muted-foreground">
              <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">{t("notes")}</p>
              <p className="whitespace-pre-line">{estimate["notes"]}</p>
            </div>
          )}

          {estimate["rejectionReason"] && (
            <div className="text-sm">
              <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">Rejection feedback</p>
              <p className="text-red-700">{estimate["rejectionReason"]}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Manage this estimate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {canSend && (
              <form
                action={async () => {
                  "use server";
                  await sendEstimate(estimate["id"], {});
                }}
              >
                <Button type="submit" className="w-full">
                  <Send className="mr-2 h-4 w-4" /> {t("sendToCustomer")}
                </Button>
              </form>
            )}
            {canConvertToInvoice && (
              <form
                action={async () => {
                  "use server";
                  await convertEstimateToInvoice(estimate["id"], {});
                }}
              >
                <Button type="submit" variant="outline" className="w-full">
                  <FileText className="mr-2 h-4 w-4" /> {t("convertToInvoice")}
                </Button>
              </form>
            )}
            {shareUrl && (
              <Button asChild variant="outline" className="w-full">
                <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> {t("viewEstimate")}
                </a>
              </Button>
            )}
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link
              href={`/dashboard/estimates/${estimate["id"]}/print`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("exportPdf")}
            >
              <Printer className="mr-2 h-4 w-4" /> {t("exportPdf")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="w-full">
            <a
              href={`/api/documents/estimates/${estimate["id"]}/pdf`}
              target="_blank"
              download
              rel="noopener noreferrer"
              aria-label={t("exportPdf")}
            >
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </a>
          </Button>
          <form
            action={async () => {
              "use server";
              await deleteEstimate(estimate["id"]);
            }}
          >
            <Button type="submit" variant="destructive" size="sm" className="w-full">
              <Trash2 className="mr-2 h-4 w-4" /> {t("delete")}
            </Button>
          </form>
        </CardContent>
        </Card>

        <EstimateAuditLog estimateId={estimate["id"]} />
      </div>
    </div>
  );
}
