import { Link } from "@/i18n/navigation";
import { requireUser, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
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

  let invoices;
  let customerCount;
  try {
    [invoices, customerCount] = await Promise["all"]([
      db["invoice"]["findMany"]({
        where: { orgId },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
      }),
      db["customer"]["count"]({ where: { orgId } }),
    ]);
  } catch (err) {
    if (isMissingColumnError(err)) {
      [invoices, customerCount] = await Promise["all"]([
        db["invoice"]["findMany"]({
          where: { orgId },
          select: {
            id: true,
            number: true,
            customerId: true,
            status: true,
            issueDate: true,
            dueDate: true,
            currency: true,
            subtotal: true,
            taxRate: true,
            taxAmount: true,
            discount: true,
            total: true,
            amountPaid: true,
            createdAt: true,
            customer: { select: { name: true, company: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        db["customer"]["count"]({ where: { orgId } }),
      ]);
    } else {
      logServerError("DashboardPage", err);
      throw err;
    }
  }

  const now = new Date();
  const totalRevenue = invoices["reduce"]((sum: number, inv: any) => sum + (inv["total"] || 0), 0);
  const outstandingBalance = invoices
    ["filter"]((inv: any) => (inv["total"] || 0) - (inv["amountPaid"] || 0) > 0)
    ["reduce"]((sum: number, inv: any) => sum + (inv["total"] || 0) - (inv["amountPaid"] || 0), 0);

  const invoiceList = invoices
    ["map"]((inv: any) => {
      const daysOverdue =
        inv["dueDate"] && new Date(inv["dueDate"]) < now
          ? Math["floor"]((now["getTime"]() - new Date(inv["dueDate"])["getTime"]()) / (1000 * 60 * 60 * 24))
          : 0;
      return {
        id: inv["id"],
        number: inv["number"],
        customerName: inv["customer"]?.["name"] || inv["customer"]?.["company"] || "Unknown",
        amount: (inv["total"] || 0) - (inv["amountPaid"] || 0),
        dueDate: inv["dueDate"],
        status: inv["status"],
        daysOverdue,
      };
    })
    ["sort"]((a: any, b: any) => {
      if (a["daysOverdue"] > 0 && b["daysOverdue"] === 0) return -1;
      if (b["daysOverdue"] > 0 && a["daysOverdue"] === 0) return 1;
      return new Date(b["dueDate"] ?? 0)["getTime"]() - new Date(a["dueDate"] ?? 0)["getTime"]();
    });

  const stats = [
    {
      label: t("totalInvoiced"),
      value: formatCurrency(totalRevenue),
      icon: FileText,
    },
    {
      label: t("outstanding"),
      value: formatCurrency(outstandingBalance),
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{tReports("invoiceManagement")}</CardTitle>
              <CardDescription>
                {invoiceList["length"]} invoices
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
              {invoiceList["length"] === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <p className="text-sm text-muted-foreground">{tReports("noInvoices")}</p>
                  </TableCell>
                </TableRow>
              ) : (
                invoiceList["slice"](0, 15)["map"]((inv) => (
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
          {invoiceList["length"] > 15 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              {invoiceList["length"] - 15} more invoices not shown
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
