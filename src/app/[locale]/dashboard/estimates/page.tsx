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
  DRAFT: "secondary",
  SENT: "default",
  VIEWED: "outline",
  ACCEPTED: "success",
  REJECTED: "destructive",
  DECLINED: "destructive",
  EXPIRED: "outline",
  INVOICED: "default",
};

export default async function EstimatesPage({ params, searchParams }: { params: { locale: string }; searchParams: { page?: string } }) {
  await requireFeature("estimates");
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];
  const t = await getTranslations("estimates");

  const page = Math.max(1, parseInt(searchParams["page"] || "1", 10) || 1);
  const take = 20;
  const skip = (page - 1) * take;

  let estimates: any[] = [];
  let total = 0;
  try {
    const data = await db["estimate"]["findMany"]({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { customer: true },
      take,
      skip,
    });
    estimates = data;
    total = await db["estimate"]["count"]({ where: { orgId } });
  } catch (err) {
    if (isMissingColumnError(err)) {
      const data = await db["estimate"]["findMany"]({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take,
        skip,
        select: {
          id: true,
          number: true,
          status: true,
          validUntil: true,
          total: true,
          customer: { select: { name: true } },
        },
      }) as any[];
      estimates = data;
      total = await db["estimate"]["count"]({ where: { orgId } });
    } else {
      logServerError("EstimatesPage", err);
      throw err;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button asChild>
          <Link href="/dashboard/estimates/new">
            <Plus className="mr-2 h-4 w-4" /> {t("newEstimate")}
          </Link>
        </Button>
      </div>
      <Card>
              <CardContent className="pt-6">
              {estimates["length"] === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noEstimates")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("number")}</TableHead>
                      <TableHead>{t("customer")}</TableHead>
                      <TableHead>{t("validUntil")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead className="text-right">{t("total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {estimates["map"]((e: any) => (
                       <TableRow key={e["id"]}>
                         <TableCell className="font-medium">
                           <Link
                             href={`/dashboard/estimates/${e["id"]}`}
                             className="text-blue-600 hover:underline"
                           >
                             {e["number"]}
                           </Link>
                         </TableCell>
                         <TableCell>{e["customer"]?.["name"] ?? "Unknown"}</TableCell>
                         <TableCell>{formatDate(e["validUntil"])}</TableCell>
                         <TableCell>
                           <Badge variant={variant[e["status"]] ?? "secondary"}>
                             {e["status"]}
                           </Badge>
                         </TableCell>
                         <TableCell className="text-right">
                           {formatCurrency(e["total"])}
                         </TableCell>
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
                        <Link href={`/dashboard/estimates?page=${page - 1}`}>Previous</Link>
                      </Button>
                    )}
                    {page < totalPages && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/estimates?page=${page + 1}`}>Next</Link>
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
