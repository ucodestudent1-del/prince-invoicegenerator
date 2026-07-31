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
  DRAFT: "secondary",
  SENT: "default",
  ACCEPTED: "success",
  DECLINED: "destructive",
  EXPIRED: "outline",
};

export default async function EstimatesPage() {
  await requireFeature("estimates");
  const user = await requireUser();
  if (!user.organizationId) return null;
  const orgId = user.organizationId;

  let estimates;
  try {
    estimates = await db.estimate.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    });
  } catch (err) {
    console.error("EstimatesPage failed to load estimates:", err);
    throw err;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Estimates</h1>
        <Button asChild>
          <Link href="/dashboard/estimates/new">
            <Plus className="mr-2 h-4 w-4" /> New estimate
          </Link>
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {estimates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No estimates yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Valid until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimates.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.number}</TableCell>
                    <TableCell>{e.customer.name}</TableCell>
                    <TableCell>{formatDate(e.validUntil)}</TableCell>
                    <TableCell>
                      <Badge variant={variant[e.status] ?? "secondary"}>
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(e.total)}
                    </TableCell>
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
