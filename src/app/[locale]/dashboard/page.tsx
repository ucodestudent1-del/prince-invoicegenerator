import { Link } from "@/i18n/navigation";
import { requireUser, getCurrentOrg, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { FileText, Plus, Users, Receipt } from "lucide-react";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";

export default async function DashboardPage({ params }: { params: { locale: string } }) {
  const user = await requireUser();
  if (!user || !user.organizationId) return null;
  const orgId = user.organizationId;
  const t = await getTranslations("dashboard");

  let invoiceAgg;
  let customerCount;
  let recentInvoices;
  try {
    [invoiceAgg, customerCount, recentInvoices] = await Promise.all([
      db.invoice.aggregate({
        where: { orgId },
        _sum: { total: true, amountPaid: true },
        _count: { _all: true },
      }),
      db.customer.count({ where: { orgId } }),
      db.invoice.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { customer: true },
      }),
    ]);
  } catch (err) {
    if (isMissingColumnError(err)) {
      [invoiceAgg, customerCount, recentInvoices] = await Promise.all([
        db.invoice.aggregate({
          where: { orgId },
          _sum: { total: true, amountPaid: true },
          _count: { _all: true },
        }),
        db.customer.count({ where: { orgId } }),
        db.invoice.findMany({
          where: { orgId },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            number: true,
            total: true,
            createdAt: true,
            customerId: true,
            customer: { select: { id: true, name: true, email: true, company: true } },
          },
        }),
      ]);
    } else {
      logServerError("DashboardPage", err);
      throw err;
    }
  }

  const outstanding =
    (invoiceAgg._sum.total ?? 0) - (invoiceAgg._sum.amountPaid ?? 0);

  const stats = [
    {
      label: t("totalInvoiced"),
      value: formatCurrency(invoiceAgg._sum.total ?? 0),
      icon: FileText,
    },
    {
      label: t("outstanding"),
      value: formatCurrency(outstanding),
      icon: Receipt,
    },
    {
      label: t("invoices"),
      value: invoiceAgg._count._all.toString(),
      icon: FileText,
    },
    {
      label: t("customers"),
      value: customerCount.toString(),
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("overview")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("welcomeBack", { name: user.name ?? "" })}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/invoices/new">
            <Plus className="mr-2 h-4 w-4" /> {t("newInvoice")}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="text-2xl font-bold">{s.value}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("recentInvoices")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentInvoices.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("noInvoicesYet")}{" "}
              <Link href="/dashboard/invoices/new" className="text-primary hover:underline">
                {t("create")}
              </Link>
              .
            </p>
          )}
          {recentInvoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between border-b pb-2 text-sm last:border-0"
            >
              <div>
                <Link
                  href={`/dashboard/invoices/${inv.id}`}
                  className="font-medium hover:underline"
                >
                  {inv.number}
                </Link>
                <span className="ml-2 text-muted-foreground">
                  {inv.customer?.name ?? "Unknown customer"}
                </span>
              </div>
              <span className="font-medium">{formatCurrency(inv.total)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
