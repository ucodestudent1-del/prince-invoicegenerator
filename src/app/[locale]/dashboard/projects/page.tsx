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
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";

export default async function ProjectsPage({ params }: { params: { locale: string } }) {
  await requireFeature("projectManagement");
  const user = await requireUser();
  if (!user || !user.organizationId) return null;
  const orgId = user.organizationId;
  const t = await getTranslations("projects");

  let projects;
  try {
    projects = await db.project.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { customer: true, _count: { select: { invoices: true, expenses: true } } },
    });
  } catch (err) {
    logServerError("ProjectsPage", err);
    throw err;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button asChild>
          <Link href="/dashboard/projects/new">
            <Plus className="mr-2 h-4 w-4" /> {t("newProject")}
          </Link>
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noProjects")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("start")}</TableHead>
                  <TableHead className="text-right">{t("invoices")}</TableHead>
                  <TableHead className="text-right">{t("expenses")}</TableHead>
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
