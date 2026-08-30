import { Link } from "@/i18n/navigation";
import { requireUser, requireFeature, isMissingColumnError } from "@/lib/org";
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

const variant: Record<string, any> = {
  PROPOSED: "secondary",
  APPROVED: "success",
  REJECTED: "destructive",
  INVOICED: "default",
};

export default async function ChangeOrdersPage({ params, searchParams }: { params: { locale: string }; searchParams: { page?: string } }) {
  await requireFeature("changeOrders");
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const t = await getTranslations("changeOrders");
  const orgId = user["organizationId"];

  const page = Math.max(1, parseInt(searchParams["page"] || "1", 10) || 1);
  const take = 20;
  const skip = (page - 1) * take;

  let cos: any[] = [];
  let total = 0;
  try {
    const data = await db["changeOrder"]["findMany"]({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { project: true },
      take,
      skip,
    });
    cos = data;
    total = await db["changeOrder"]["count"]({ where: { orgId } });
  } catch (err) {
    if (isMissingColumnError(err)) {
      const data = await db["changeOrder"]["findMany"]({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take,
        skip,
        select: {
          id: true,
          number: true,
          title: true,
          amount: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          projectId: true,
          project: { select: { id: true, name: true } },
        },
      });
      cos = data;
      total = await db["changeOrder"]["count"]({ where: { orgId } });
    } else {
      logServerError("ChangeOrdersPage", err);
      throw err;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button asChild>
          <Link href="/dashboard/change-orders/new">
            <Plus className="mr-2 h-4 w-4" /> {t("newChangeOrder")}
          </Link>
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {cos["length"] === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noChangeOrders")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("number")}</TableHead>
                  <TableHead>{t("title")}</TableHead>
                  <TableHead>{t("project")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cos["map"]((co) => (
                  <TableRow key={co["id"]}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/change-orders/${co["id"]}`} className="font-medium">
                        {co["number"]}
                      </Link>
                    </TableCell>
                    <TableCell>{co["title"]}</TableCell>
                    <TableCell>{(co as any).project?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={variant[co["status"]] ?? "secondary"}>{co["status"]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(co["amount"])}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/change-orders?page=${page - 1}`}>Previous</Link>
                  </Button>
                )}
                {page < totalPages && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/change-orders?page=${page + 1}`}>Next</Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
