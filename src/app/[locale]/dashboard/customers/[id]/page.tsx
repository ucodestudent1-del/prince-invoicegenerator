import { Link, redirect } from "@/i18n/navigation";
import { requireUser, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  FileText,
  DollarSign,
  Archive,
  Edit,
  Plus,
} from "lucide-react";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";
import { ClientDetailView } from "@/components/client-detail-view";

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string; locale: string };
}) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];
  const t = await getTranslations("customers");

  let customer;
  try {
    customer = await db["customer"]["findFirst"]({
      where: { id: params["id"], orgId },
      include: {
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { payments: { orderBy: { createdAt: "desc" } } },
        },
        estimates: { orderBy: { createdAt: "desc" }, take: 50 },
        addresses: { orderBy: { createdAt: "desc" } },
      },
    });
  } catch (err) {
    if (isMissingColumnError(err)) {
      customer = await db["customer"]["findFirst"]({
        where: { id: params["id"], orgId },
        include: {
          invoices: { orderBy: { createdAt: "desc" }, take: 50 },
          estimates: { orderBy: { createdAt: "desc" }, take: 50 },
          addresses: { orderBy: { createdAt: "desc" } },
        },
      });
    } else {
      logServerError("CustomerDetailPage", err);
      throw err;
    }
  }

  if (!customer) {
    redirect({ href: "/dashboard/customers", locale: params["locale"] });
    throw new Error("Unreachable: redirect should have exited");
  }

  // Calculate financial summary
  const totalInvoiced = customer["invoices"]["reduce"]((sum: number, inv: any) => sum + inv["total"], 0);
  const totalPaid = customer["invoices"]["reduce"]((sum: number, inv: any) => sum + inv["amountPaid"], 0);
  const outstandingBalance = totalInvoiced - totalPaid;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/customers">
              <ArrowLeft className="mr-2 h-4 w-4" /> {t("back")}
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{customer["name"]}</h1>
            {customer["company"] && (
              <p className="text-sm text-muted-foreground">{customer["company"]}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/dashboard/customers/${customer["id"]}/edit`}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/invoices/new?customerId=${customer["id"]}`}>
              <Plus className="mr-2 h-4 w-4" /> New Invoice
            </Link>
          </Button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <Badge
          variant={customer["status"] === "ACTIVE" ? "default" : "secondary"}
          className="text-xs"
        >
          {customer["status"]}
        </Badge>
        {customer["portalAccess"] && (
          <Badge variant="outline" className="text-xs">
            Portal Access
          </Badge>
        )}
      </div>

      {/* Financial Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalInvoiced)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${outstandingBalance > 0 ? "text-orange-600" : ""}`}>
              {formatCurrency(outstandingBalance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm">{customer["email"] || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm">{customer["phone"] || "—"}</p>
            </div>
          </div>
          {customer["website"] && (
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Website</p>
                <p className="text-sm">{customer["website"]}</p>
              </div>
            </div>
          )}
          {customer["taxId"] && (
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Tax ID</p>
                <p className="text-sm">{customer["taxId"]}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for Invoices, Estimates, Activity */}
      <ClientDetailView customerId={customer["id"]} />
    </div>
  );
}
