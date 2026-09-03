import { requireUser, requireFeature, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getProjectFinancials } from "@/lib/actions/projects";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Printer } from "lucide-react";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function ProjectPrintPage({
  params,
}: {
  params: { id: string; locale: string };
}) {
  await requireFeature("projectManagement");
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];
  const t = await getTranslations("projects");

  let project;
  let invoiced = 0;
  let paid = 0;
  let costs = 0;

  try {
    project = await db["project"]["findFirst"]({
      where: { id: params["id"], orgId },
      include: { customer: true },
    });

    if (isMissingColumnError(await Promise.resolve(null))) {
      throw new Error("fallback needed");
    }
  } catch (err) {
    if (isMissingColumnError(err)) {
      project = await db["project"]["findFirst"]({
        where: { id: params["id"], orgId },
        select: {
          id: true,
          name: true,
          number: true,
          address: true,
          startDate: true,
          endDate: true,
          estCompletionDate: true,
          status: true,
          contractValue: true,
          paymentTerms: true,
          taxRate: true,
          retainageRate: true,
          customer: { select: { id: true, name: true, company: true, email: true, address: true } },
        },
      });
    } else {
      logServerError("ProjectPrintPage", err);
      throw err;
    }
  }

  if (!project) {
    throw new Error("Project not found");
  }

  const financials = await getProjectFinancials(params["id"]);

  const customerName =
    (project as any)["customer"]?.["name"] ||
    (project as any)["customer"]?.["company"] ||
    "—";

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Print Header */}
      <div className="flex justify-between items-start mb-6 pb-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">{project["name"] || project["number"] || "—"}</h1>
          <p className="text-sm text-muted-foreground">
            {t("projectNumber")}: {project["number"] || "—"}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" onClick={() => window.print()}>
          <button>
            <Printer className="mr-2 h-4 w-4" /> Print
          </button>
        </Button>
      </div>

      {/* Project Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">{t("projectDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="font-medium text-muted-foreground">{t("customer")}:</span> {customerName}
          </div>
          <div>
            <span className="font-medium text-muted-foreground">{t("status")}:</span> {project["status"] ?? "ACTIVE"}
          </div>
          <div>
            <span className="font-medium text-muted-foreground">{t("jobAddress")}:</span> {project["address"] || "—"}
          </div>
          <div>
            <span className="font-medium text-muted-foreground">{t("startDate")}:</span> {formatDate(project["startDate"])}
          </div>
          <div>
            <span className="font-medium text-muted-foreground">{t("endDate")}:</span> {formatDate(project["endDate"])}
          </div>
          <div>
            <span className="font-medium text-muted-foreground">{t("estCompletionDate")}:</span> {formatDate(project["estCompletionDate"])}
          </div>
          <div>
            <span className="font-medium text-muted-foreground">{t("contractValue")}:</span> {formatCurrency(project["contractValue"] || 0)}
          </div>
          <div>
            <span className="font-medium text-muted-foreground">{t("paymentTerms")}:</span> {project["paymentTerms"] || "NET_30"}
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Original Contract Value</TableCell>
                <TableCell className="text-right">{formatCurrency(financials["originalContractValue"])}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Approved Change Orders</TableCell>
                <TableCell className="text-right">{formatCurrency(financials["approvedChangeOrders"])}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Current Contract Value</TableCell>
                <TableCell className="text-right">{formatCurrency(financials["currentContractValue"])}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Total Invoiced</TableCell>
                <TableCell className="text-right">{formatCurrency(financials["totalInvoiced"])}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Total Paid</TableCell>
                <TableCell className="text-right">{formatCurrency(financials["totalCollected"])}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Outstanding Balance</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(financials["outstandingBalance"])}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Project Costs</TableCell>
                <TableCell className="text-right">{formatCurrency(financials["projectCosts"])}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Gross Profit</TableCell>
                <TableCell className={`text-right font-bold ${financials["grossProfit"] >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(financials["grossProfit"])}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Gross Margin</TableCell>
                <TableCell className="text-right">{financials["grossMargin"]}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
