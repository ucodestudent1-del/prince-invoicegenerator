import Link from "next/link";
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

export default async function ExpensesPage() {
  await requireFeature("expenseTracking");
  const user = await requireUser();
  if (!user.organizationId) return null;
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
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Total tracked: <strong>{formatCurrency(total)}</strong>
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/expenses/new">
            <Plus className="mr-2 h-4 w-4" /> New expense
          </Link>
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Photo</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
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
