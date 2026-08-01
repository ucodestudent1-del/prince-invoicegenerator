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

const variant: Record<string, any> = {
  PROPOSED: "secondary",
  APPROVED: "success",
  REJECTED: "destructive",
  INVOICED: "default",
};

export default async function ChangeOrdersPage() {
  await requireFeature("changeOrders");
  const user = await requireUser();
  if (!user.organizationId) return null;
  let cos;
  try {
    cos = await db.changeOrder.findMany({
      where: { orgId: user.organizationId },
      orderBy: { createdAt: "desc" },
      include: { project: true },
    });
  } catch (err) {
    console.error("Failed to load change orders:", err);
    throw err;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Change Orders</h1>
        <Button asChild>
          <Link href="/dashboard/change-orders/new">
            <Plus className="mr-2 h-4 w-4" /> New change order
          </Link>
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {cos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No change orders yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cos.map((co) => (
                  <TableRow key={co.id}>
                    <TableCell className="font-medium">{co.number}</TableCell>
                    <TableCell>{co.title}</TableCell>
                    <TableCell>{co.project?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={variant[co.status] ?? "secondary"}>{co.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(co.amount)}</TableCell>
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
