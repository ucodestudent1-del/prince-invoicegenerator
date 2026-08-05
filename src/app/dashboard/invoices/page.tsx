import Link from "next/link";
import { requireUser } from "@/lib/org";
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

const statusVariant: Record<string, any> = {
  DRAFT: "secondary",
  SENT: "default",
  PAID: "success",
  UNPAID: "outline",
  OVERDUE: "destructive",
  VOID: "outline",
};

export default async function InvoicesPage() {
  const user = await requireUser();
  if (!user.organizationId) return null;
  const orgId = user.organizationId;

  let invoices;
  try {
    invoices = await db.invoice.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    });
  } catch (err) {
    logServerError("InvoicesPage", err);
    throw err;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Button asChild>
          <Link href="/dashboard/invoices/new">
            <Plus className="mr-2 h-4 w-4" /> New invoice
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No invoices yet. Create your first one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const outstanding = inv.total - inv.amountPaid;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/invoices/${inv.id}`}
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
