import { Link } from "@/i18n/navigation";
import { requireUser, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { logServerError } from "@/lib/errors";
import { ExportCsvButton } from "@/components/export-csv-button";
import { getTranslations } from "next-intl/server";

const statusVariant: Record<string, any> = {
  DRAFT: "secondary",
  SENT: "default",
  PAID: "success",
  UNPAID: "outline",
  OVERDUE: "destructive",
  VOID: "outline",
};

export default async function InvoicesPage({ params }: { params: { locale: string } }) {
  const user = await requireUser();
  if (!user || !user.organizationId) return null;
  const orgId = user.organizationId;
  const t = await getTranslations("invoices");

  let invoices;
  try {
    invoices = await db.invoice.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    });
  } catch (err) {
    if (isMissingColumnError(err)) {
      invoices = await db.invoice.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          type: true,
          status: true,
          issueDate: true,
          dueDate: true,
          currency: true,
          subtotal: true,
          taxRate: true,
          taxAmount: true,
          discount: true,
          retainageRate: true,
          retainageAmount: true,
          total: true,
          amountPaid: true,
          notes: true,
          stripeInvoiceId: true,
          recurringConfigId: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
          customerId: true,
          projectId: true,
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              company: true,
              phone: true,
              address: true,
              notes: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });
    } else {
      logServerError("InvoicesPage", err);
      throw err;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/${params.locale}/dashboard/invoices/new`}>
              <Plus className="mr-2 h-4 w-4" /> {t("newInvoice")}
            </Link>
          </Button>
          <ExportCsvButton orgId={orgId} />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noInvoices")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("number")}</TableHead>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("issue")}</TableHead>
                  <TableHead>{t("due")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("total")}</TableHead>
                  <TableHead className="text-right">{t("outstanding")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const outstanding = inv.total - inv.amountPaid;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link
                          href={`/${params.locale}/dashboard/invoices/${inv.id}`}
                          className="font-medium hover:underline"
                        >
                          {inv.number}
                        </Link>
                      </TableCell>
                      <TableCell>{inv.customer?.name ?? "Unknown"}</TableCell>
                      <TableCell className="text-muted-foreground">{inv.type}</TableCell>
                      <TableCell>{formatDate(inv.issueDate)}</TableCell>
                      <TableCell>{formatDate(inv.dueDate)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[inv.status] ?? "secondary"}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(inv.total, inv.currency)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(outstanding, inv.currency)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
