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
import { formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";

export default async function SubcontractorsPage() {
  await requireFeature("subcontractorTracking");
  const user = await requireUser();
  if (!user.organizationId) return null;
  const subs = await db.subcontractor.findMany({
    where: { orgId: user.organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Subcontractors</h1>
        <Button asChild>
          <Link href="/dashboard/subcontractors/new">
            <Plus className="mr-2 h-4 w-4" /> New subcontractor
          </Link>
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {subs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subcontractors yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Projects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.company ?? "—"}</TableCell>
                    <TableCell>
                      {s.trade ? <Badge variant="secondary">{s.trade}</Badge> : "—"}
                    </TableCell>
                    <TableCell>{s.email ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {s.rate ? formatCurrency(Number(s.rate)) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{s._count.projects}</TableCell>
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
