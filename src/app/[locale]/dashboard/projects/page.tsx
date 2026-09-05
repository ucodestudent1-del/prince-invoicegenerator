import { Link } from "@/i18n/navigation";
import { requireUser, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ProjectStatusBadge } from "@/components/project-status-badge";
import {
  Plus,
  Search,
  Filter,
} from "lucide-react";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { q?: string; status?: string; customer?: string };
}) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];
  const t = await getTranslations("projects");
  const tCommon = await getTranslations("common");

  const query = searchParams["q"] ?? "";
  const statusFilter = searchParams["status"] ?? "all";
  const customerFilter = searchParams["customer"] ?? "all";

  let projects: any[] = [];
  try {
    const where: any = { orgId };

    if (query) {
      where["OR"] = [
        { name: { contains: query, mode: "insensitive" } },
        { number: { contains: query, mode: "insensitive" } },
      ];
    }

    if (statusFilter !== "all") {
      where["status"] = statusFilter;
    }

    if (customerFilter !== "all") {
      where["customerId"] = customerFilter;
    }

    projects = await db["project"]["findMany"]({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        _count: { select: { invoices: true, expenses: true } },
      },
    });
  } catch (err) {
    if (isMissingColumnError(err)) {
      try {
        projects = await db["project"]["findMany"]({
          where: { orgId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            number: true,
            address: true,
            startDate: true,
            endDate: true,
            status: true,
            contractValue: true,
            customerId: true,
            createdAt: true,
            updatedAt: true,
            customer: { select: { id: true, name: true, company: true, email: true } },
            _count: { select: { invoices: true, expenses: true } },
          },
        });
      } catch (innerErr) {
        // Last-resort fallback: no `_count`, no nested `customer`. The page
        // still renders even on a fully drifted database.
        if (isMissingColumnError(innerErr)) {
          logServerError("ProjectsPage (final fallback)", innerErr);
          projects = await db["project"]["findMany"]({
            where: { orgId },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              name: true,
              number: true,
              address: true,
              startDate: true,
              endDate: true,
              status: true,
              contractValue: true,
              customerId: true,
              createdAt: true,
            },
          });
        } else {
          throw innerErr;
        }
      }
    } else {
      logServerError("ProjectsPage", err);
      throw err;
    }
  }

  // Fetch all customers for filter dropdown
  let customers: any[] = [];
  try {
    customers = await db["customer"]["findMany"]({
      where: { orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } catch {}

  // Compute summary metrics
  const now = new Date();
  const activeProjects = projects["filter"]((p) => (p["status"] ?? "ACTIVE") === "ACTIVE");
  const totalContractValue = projects["reduce"]((sum, p) => sum + (Number(p["contractValue"]) || 0), 0);

  // Outstanding invoices: sum of (total - amountPaid) for non-draft, non-void invoices
  // We need to fetch invoice data for the projects
  let allInvoices: any[] = [];
  try {
    allInvoices = await db["invoice"]["findMany"]({
      where: { orgId, projectId: { in: projects["map"]((p) => p["id"]) } },
      select: { projectId: true, total: true, amountPaid: true, dueDate: true, status: true },
    });
  } catch {}

  const outstandingInvoices = allInvoices["reduce"]((sum, inv) => {
    const invOutstanding = (Number(inv["total"]) || 0) - (Number(inv["amountPaid"]) || 0);
    return sum + (invOutstanding > 0 ? invOutstanding : 0);
  }, 0);

  const overdueAmount = allInvoices["reduce"]((sum, inv) => {
    const due = inv["dueDate"] ? new Date(inv["dueDate"]) : null;
    const invOutstanding = (Number(inv["total"]) || 0) - (Number(inv["amountPaid"]) || 0);
    if (due && due < now && inv["status"] !== "VOID" && inv["status"] !== "CANCELLED" && invOutstanding > 0) {
      return sum + invOutstanding;
    }
    return sum;
  }, 0);

  // Build filter dropdown for customers
  const uniqueCustomerIds = new Set(projects["map"]((p) => p["customerId"]).filter(Boolean));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {projects["length"]} projects
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects/new">
            <Plus className="mr-2 h-4 w-4" /> {t("newProject")}
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("activeProjects")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProjects["length"]}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("totalContractValue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalContractValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("outstandingInvoices")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(outstandingInvoices)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("overdueAmount")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(overdueAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <form method="GET" className="flex gap-2">
            <Input
              name="q"
              type="search"
              placeholder={t("searchProjects")}
              defaultValue={query}
              className="pl-10"
            />
            <input type="hidden" name="status" value={statusFilter} />
            <input type="hidden" name="customer" value={customerFilter} />
            <Button type="submit" size="sm" variant="outline">
              {tCommon("search")}
            </Button>
            {(query || statusFilter !== "all" || customerFilter !== "all") && (
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/projects">×</Link>
              </Button>
            )}
          </form>
        </div>

        <div className="flex gap-2">
          <select
            name="status"
            defaultValue={statusFilter}
            onChange={(e) => {
              const url = new URLSearchParams(window.location.search);
              url.set("status", e.target.value);
              url.set("q", query);
              window.location.search = url.toString();
            }}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="all">{t("allStatuses")}</option>
            <option value="ACTIVE">{t("statusActive")}</option>
            <option value="COMPLETED">{t("statusCompleted")}</option>
            <option value="ON_HOLD">{t("statusOnHold")}</option>
            <option value="CANCELLED">{t("statusCancelled")}</option>
          </select>

          <select
            name="customer"
            defaultValue={customerFilter}
            onChange={(e) => {
              const url = new URLSearchParams(window.location.search);
              url.set("customer", e.target.value);
              url.set("q", query);
              window.location.search = url.toString();
            }}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="all">{t("allCustomers")}</option>
            {customers["map"]((c) => (
              <option key={c["id"]} value={c["id"]}>
                {c["name"]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Projects Table */}
      <Card>
        <CardContent className="pt-6">
          {projects["length"] === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noProjects")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead className="text-right">{t("contractValue")}</TableHead>
                  <TableHead className="text-right">{t("invoiced")}</TableHead>
                  <TableHead className="text-right">{t("paid")}</TableHead>
                  <TableHead className="text-right">{t("balance")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects["map"]((p) => {
                  const projectInvoices = allInvoices["filter"]((inv) => inv["projectId"] === p["id"]);
                  const invoiced = projectInvoices["reduce"]((sum, inv) => sum + (Number(inv["total"]) || 0), 0);
                  const paid = projectInvoices["reduce"]((sum, inv) => sum + (Number(inv["amountPaid"]) || 0), 0);
                  const balance = invoiced - paid;

                  return (
                    <TableRow key={p["id"]}>
                      <TableCell>
                        <Link
                          href={`/dashboard/projects/${p["id"]}`}
                          className="font-medium hover:underline"
                        >
                          {p["name"]}
                        </Link>
                        {p["number"] && (
                          <span className="text-xs text-muted-foreground ml-2">#{p["number"]}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {p["customer"]?.["name"] ?? p["customer"]?.["company"] ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(p["contractValue"]) || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(invoiced)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(paid)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(balance)}
                      </TableCell>
                      <TableCell>
                        <ProjectStatusBadge status={p["status"] ?? "ACTIVE"} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
