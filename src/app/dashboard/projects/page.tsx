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
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";

export default async function ProjectsPage() {
  await requireFeature("projectManagement");
  const user = await requireUser();
  if (!user.organizationId) return null;
  const orgId = user.organizationId;

  let projects;
  try {
    projects = await db.project.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { customer: true, _count: { select: { invoices: true, expenses: true } } },
    });
  } catch (err) {
    console.error("ProjectsPage failed to load projects:", err);
    throw err;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button asChild>
          <Link href="/dashboard/projects/new">
            <Plus className="mr-2 h-4 w-4" /> New project
          </Link>
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.customer?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{p.status}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(p.startDate)}</TableCell>
                    <TableCell className="text-right">{p._count.invoices}</TableCell>
                    <TableCell className="text-right">{p._count.expenses}</TableCell>
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
