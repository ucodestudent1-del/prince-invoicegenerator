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
import { formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";

export default async function SubcontractorsPage({ params }: { params: { locale: string } }) {
  await requireFeature("subcontractorTracking");
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const t = await getTranslations("subcontractors");

  let subs;
  try {
    subs = await db["subcontractor"]["findMany"]({
      where: { orgId: user["organizationId"] },
      orderBy: { name: "asc" },
      include: { _count: { select: { projects: true } } },
    });
  } catch (err) {
    logServerError("SubcontractorsPage", err);
    throw err;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button asChild>
          <Link href="/dashboard/subcontractors/new">
            <Plus className="mr-2 h-4 w-4" /> {t("newSubcontractor")}
          </Link>
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {subs["length"] === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noSubcontractors")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("company")}</TableHead>
                  <TableHead>{t("trade")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead className="text-right">{t("rate")}</TableHead>
                  <TableHead className="text-right">{t("projects")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs["map"]((s) => (
                  <TableRow key={s["id"]}>
                    <TableCell className="font-medium">{s["name"]}</TableCell>
                    <TableCell>{s["company"] ?? "—"}</TableCell>
                    <TableCell>
                      {s["trade"] ? <Badge variant="secondary">{s["trade"]}</Badge> : "—"}
                    </TableCell>
                    <TableCell>{s["email"] ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {s["rate"] ? formatCurrency(Number(s["rate"])) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{s["_count"]["projects"]}</TableCell>
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
