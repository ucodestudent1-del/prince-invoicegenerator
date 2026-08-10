import { Link } from "@/i18n/navigation";
import { requireUser, requireFeature } from "@/lib/org";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { getTranslations } from "next-intl/server";

export default async function ExpensesPage({ params }: { params: { locale: string } }) {
  await requireFeature("expenseTracking");
  const user = await requireUser();
  if (!user || !user.organizationId) return null;
  const t = await getTranslations("expenses");
  let expenses;
  try {
    expenses = await db.expense.findMany({
      where: { orgId: user.organizationId },
      orderBy: { date: "desc" },
      include: { project: true, photo: true },
    });
  } catch (err) {
    logServerError("ExpensesPage", err);
    throw err;
  }
  const total = expenses.reduce((a, e) => a + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("totalTracked", { amount: formatCurrency(total) })}
          </p>
        </div>
        <Button asChild>
          <Link href={`/${params.locale}/dashboard/expenses/new`}>
            <Plus className="mr-2 h-4 w-4" /> {t("newExpense")}
          </Link>
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noExpenses")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("vendor")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead>{t("project")}</TableHead>
                  <TableHead>{t("photo")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDate(e.date)}</TableCell>
                    <TableCell>{e.vendor ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{e.category}</Badge>
                    </TableCell>
                    <TableCell>{e.project?.name ?? "—"}</TableCell>
                    <TableCell>{e.photo ? "📎" : "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(e.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
