import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/org";
import { db } from "@/lib/db";
import { getFinancialDashboardData } from "@/lib/actions/reports";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  FileText,
  Plus,
  Users,
  Receipt,
  TrendingUp,
  Clock,
  Download,
} from "lucide-react";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";
import { getOnboardingState } from "@/lib/actions/onboarding";
import { redirect } from "@/i18n/navigation";
import { getLocaleSafe } from "@/lib/locale";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | null | undefined> = {
  DRAFT: "secondary",
  SENT: "default",
  VIEWED: "outline",
  PAID: "success",
  PARTIALLY_PAID: "default",
  UNPAID: "outline",
  OVERDUE: "destructive",
  VOID: "outline",
};

export default async function DashboardPage({ params }: { params: { locale: string } }) {
  const user = await requireUser();
  const locale = await getLocaleSafe();

  const onboarding = await getOnboardingState();
  if (onboarding["shouldOnboard"]) {
    redirect({ href: "/onboarding", locale });
  }

  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];
  const t = await getTranslations("dashboard");
  const tReports = await getTranslations("reports");

  let financialData;
  let customerCount;
  try {
    [financialData, customerCount] = await Promise["all"]([
      getFinancialDashboardData(),
      db["customer"]["count"]({ where: { orgId } }),
    ]);
  } catch (err) {
    logServerError("DashboardPage", err);
    throw err;
  }

  const { kpis, revenueOverTime, paidVsOutstanding, overdueBreakdown, revenueByCustomer, invoices } = financialData;

  const maxRevenueValue = Math["max"](0, ...revenueOverTime["map"]((d) => d["total"]), 1);
  const maxBarValue = Math["max"](paidVsOutstanding["paid"], paidVsOutstanding["outstanding"], 1);
  const maxOverdueValue = Math["max"](0, ...overdueBreakdown["map"]((d) => d["amount"]), 1);

  const stats = [
    {
      label: t("totalInvoiced"),
      value: formatCurrency(kpis["totalRevenue"]),
      icon: FileText,
    },
    {
      label: t("outstanding"),
      value: formatCurrency(kpis["outstandingBalance"]),
      icon: Receipt,
    },
    {
      label: t("invoices"),
      value: invoices["length"]["toString"](),
      icon: FileText,
    },
    {
      label: t("customers"),
      value: customerCount["toString"](),
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("overview")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("welcomeBack", { name: user["name"] ?? "" })}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/invoices/new">
            <Plus className="mr-2 h-4 w-4" /> {t("newInvoice")}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats["map"]((s) => (
          <Card key={s["label"]}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s["label"]}
              </CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="text-2xl font-bold">{s["value"]}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tReports("overdueAmount")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(kpis["overdueAmount"])}
            </div>
            <p className="text-xs text-muted-foreground">
              {overdueBreakdown["length"]} overdue invoice(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tReports("paidThisMonth")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(kpis["paidThisMonth"])}
            </div>
            <p className="text-xs text-muted-foreground">
              Payments received this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tReports("totalRevenue")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(kpis["totalRevenue"])}
            </div>
            <p className="text-xs text-muted-foreground">
              Total invoiced across all customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tReports("outstandingBalance")}</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(kpis["outstandingBalance"])}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently owed by customers
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tReports("revenueOverTime")}</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {revenueOverTime["length"] > 0 ? (
                <div className="h-full w-full flex items-end gap-1">
                  {revenueOverTime["map"]((d, i) => {
                    const heightPct = maxRevenueValue > 0
                      ? Math["max"]((d["total"] / maxRevenueValue) * 100, d["total"] > 0 ? 2 : 0)
                      : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center h-full justify-end">
                        <div
                          className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors"
                          style={{ height: `${heightPct}%`, minHeight: d["total"] > 0 ? "4px" : "0" }}
                          title={`${d["date"]}: ${formatCurrency(d["total"])}`}
                        />
                        <span className="text-[8px] text-muted-foreground rotate-[-45deg] mt-1">
                          {d["date"]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No data available.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tReports("paidVsOutstanding")}</CardTitle>
            <CardDescription>Current period snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-4">
                <span className="w-12 text-sm font-medium text-emerald-700">Paid</span>
                <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded transition-all duration-500"
                    style={{
                      width: `${(paidVsOutstanding["paid"] / maxBarValue) * 100}%`,
                      minWidth: "2px",
                    }}
                  />
                </div>
                <span className="w-32 text-sm font-medium text-right">
                  {formatCurrency(paidVsOutstanding["paid"])}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="w-12 text-sm font-medium text-amber-700">Outstanding</span>
                <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded transition-all duration-500"
                    style={{
                      width: `${(paidVsOutstanding["outstanding"] / maxBarValue) * 100}%`,
                      minWidth: "2px",
                    }}
                  />
                </div>
                <span className="w-32 text-sm font-medium text-right">
                  {formatCurrency(paidVsOutstanding["outstanding"])}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tReports("overdueBreakdown")}</CardTitle>
            <CardDescription>Sorted by days overdue</CardDescription>
          </CardHeader>
          <CardContent>
            {overdueBreakdown["length"] === 0 ? (
              <p className="text-sm text-muted-foreground">{tReports("noOverdue")}</p>
            ) : (
              <div className="space-y-3 pt-2">
                {overdueBreakdown["slice"](0, 8)["map"]((item, i) => {
                  const barWidth = (item["amount"] / maxOverdueValue) * 100;
                  return (
                    <div key={`${item["invoiceNumber"]}-${i}`} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item["customerName"]}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(item["amount"])} · {item["daysOverdue"]}d overdue
                        </span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded"
                          style={{ width: `${barWidth}%`, minWidth: "2px" }}
                        />
                      </div>
                    </div>
                  );
                })}
                {overdueBreakdown["length"] > 8 && (
                  <p className="text-xs text-muted-foreground">
                    +{overdueBreakdown["length"] - 8} more overdue invoices
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tReports("revenueByCustomer")}</CardTitle>
            <CardDescription>Top 5 customers + others</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative w-28 h-28">
                {revenueByCustomer["length"] > 0 ? (
                  <div
                    className="w-full h-full rounded-full"
                    style={{
                      background: revenueByCustomer
                        ["map"](
                          (c, i, arr) =>
                            `${c["color"]} ${i === 0 ? "0%" : `${(arr["slice"](0, i)["reduce"]((s, x) => s + x["amount"], 0) / (revenueByCustomer["reduce"]((s, x) => s + x["amount"], 0) || 1)) * 100}%`} ` +
                            `${((arr["slice"](0, i + 1)["reduce"]((s, x) => s + x["amount"], 0)) / (revenueByCustomer["reduce"]((s, x) => s + x["amount"], 0) || 1)) * 100}%`
                        )
                        ["join"](", "),
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 rounded-full" />
                )}
              </div>
              <div className="space-y-1.5">
                {revenueByCustomer["map"]((c, i) => (
                  <div key={c["name"]} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: c["color"] }}
                    />
                    <span className="text-sm">{c["name"]}</span>
                    <span className="text-sm font-medium text-muted-foreground">
                      {formatCurrency(c["amount"])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{tReports("invoiceManagement")}</CardTitle>
              <CardDescription>
                {invoices["length"]} invoices
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/api/export/invoices?format=csv">
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tReports("invoiceId")}</TableHead>
                <TableHead>{tReports("customerName")}</TableHead>
                <TableHead className="text-right">{tReports("amount")}</TableHead>
                <TableHead>{tReports("dueDate")}</TableHead>
                <TableHead>{tReports("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices["length"] === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <p className="text-sm text-muted-foreground">{tReports("noInvoices")}</p>
                  </TableCell>
                </TableRow>
              ) : (
                invoices["slice"](0, 15)["map"]((inv) => (
                  <TableRow key={inv["id"]}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/invoices/${inv["id"]}`} className="hover:underline">
                        {inv["number"]}
                      </Link>
                    </TableCell>
                    <TableCell>{inv["customerName"]}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(inv["amount"])}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{formatDate(inv["dueDate"])}</span>
                        {inv["daysOverdue"] > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {inv["daysOverdue"]}d
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[inv["status"]] ?? "secondary"}>
                        {inv["status"]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {invoices["length"] > 15 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              {invoices["length"] - 15} more invoices not shown
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
