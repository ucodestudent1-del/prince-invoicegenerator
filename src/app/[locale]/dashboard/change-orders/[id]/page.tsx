import { Link, redirect } from "@/i18n/navigation";
import { requireUser, requireFeature, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { logServerError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function ChangeOrderDetailPage({
  params,
}: {
  params: { id: string; locale: string };
}) {
  await requireFeature("changeOrders");
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;

  let changeOrder;
  try {
    changeOrder = await db["changeOrder"]["findFirst"]({
      where: { id: params["id"], orgId: user["organizationId"] },
      include: {
        project: true,
        invoice: { select: { id: true, number: true, status: true, total: true } },
      },
    });
  } catch (err) {
    if (isMissingColumnError(err)) {
      changeOrder = await db["changeOrder"]["findFirst"]({
        where: { id: params["id"], orgId: user["organizationId"] },
        select: {
          id: true,
          number: true,
          title: true,
          description: true,
          amount: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          projectId: true,
          invoiceId: true,
          project: { select: { id: true, name: true } },
          invoice: { select: { id: true, number: true, status: true, total: true } },
        },
      });
    } else {
      logServerError("ChangeOrderDetailPage", err);
      throw err;
    }
  }

  if (!changeOrder) {
    redirect({ href: "/dashboard/change-orders", locale: params["locale"] });
    throw new Error("Unreachable: redirect should have exited");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/change-orders">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/dashboard/change-orders/${changeOrder["id"]}/print`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Printer className="mr-2 h-4 w-4" /> Export PDF
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={`/api/documents/change-orders/${changeOrder["id"]}/pdf`}
              target="_blank"
              download
              rel="noopener noreferrer"
            >
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{changeOrder["title"]}</CardTitle>
          <CardDescription>Change Order #{changeOrder["number"]}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{changeOrder["status"]}</Badge>
            <span className="text-muted-foreground">Status</span>
          </div>
          <div>
            <span className="font-semibold">Amount</span>{" "}
            {formatCurrency(changeOrder["amount"])}
          </div>
          <div>
            <span className="font-semibold">Created</span>{" "}
            {formatDate(changeOrder["createdAt"])}
          </div>
          {changeOrder["project"] && (
            <div>
              <span className="font-semibold">Project</span>{" "}
              {changeOrder["project"]["name"]}
            </div>
          )}
          {changeOrder["invoice"] && (
            <div>
              <span className="font-semibold">Linked Invoice</span>{" "}
              #{changeOrder["invoice"]["number"]} ({changeOrder["invoice"]["status"]})
            </div>
          )}
          {changeOrder["description"] && (
            <div>
              <span className="font-semibold">Description</span>
              <p className="whitespace-pre-line text-muted-foreground">{changeOrder["description"]}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
