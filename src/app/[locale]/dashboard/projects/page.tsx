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
import { ProjectStatusBadge, PROJECT_STATUSES, PROJECT_STATUS_LABEL } from "@/components/project-status-badge";
import { PROJECT_TYPES, PROJECT_TYPE_LABEL, type ProjectTypeKey } from "@/lib/project-types";
import {
  Plus,
  Search,
  Filter,
  AlertCircle,
} from "lucide-react";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { q?: string; status?: string; customer?: string; type?: string; attention?: string };
}) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];
  const t = await getTranslations("projects");
  const tCommon = await getTranslations("common");

  const query = searchParams["q"] ?? "";
  const statusFilter = searchParams["status"] ?? "all";
  const customerFilter = searchParams["customer"] ?? "all";
  const typeFilter = searchParams["type"] ?? "all";
  const attentionOnly = searchParams["attention"] === "1";

  let projects: any[] = [];
  try {
    const where: any = { orgId };

    if (query) {
      where["OR"] = [
        { name: { contains: query, mode: "insensitive" } },
        { number: { contains: query, mode: "insensitive" } },
        { address: { contains: query, mode: "insensitive" } },
        { customer: { is: { name: { contains: query, mode: "insensitive" } } } },
      ];
    }

    if (statusFilter !== "all") {
      where["status"] = statusFilter;
    }

    if (customerFilter !== "all") {
      where["customerId"] = customerFilter;
    }

    if (typeFilter !== "all") {
      where["projectType"] = typeFilter;
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
            projectType: true,
            customerId: true,
            createdAt: true,
            updatedAt: true,
            customer: { select: { id: true, name: true, company: true, email: true } },
            _count: { select: { invoices: true, expenses: true } },
          },
        });
      } catch (innerErr) {
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
              projectType: true,
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

  // Filter by attention if requested
  let customers: any[] = [];
  try {
    customers = await db["customer"]["findMany"]({
      where: { orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } catch {}

  const now = new Date();
  const activeProjects = projects["filter"]((p) => {
    const s = p["status"] ?? "ACTIVE";
    return ["ACTIVE", "IN_PROGRESS", "SCHEDULED", "APPROVED"].includes(s);
  });
  const completedProjects = projects["filter"]((p) => ["COMPLETED", "CLOSED"].includes(p["status"] ?? ""));
  const onHoldProjects = projects["filter"]((p) => p["status"] === "ON_HOLD");
  const totalContractValue = projects["reduce"]((sum, p) => sum + (Number(p["contractValue"]) || 0), 0);

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

  // Build per-project KPIs
  const projectKpis = projects["map"]((p) => {
    const projectInvoices = allInvoices["filter"]((inv) => inv["projectId"] === p["id"]);
    const invoiced = projectInvoices["reduce"]((sum, inv) => sum + (Number(inv["total"]) || 0), 0);
    const paid = projectInvoices["reduce"]((sum, inv) => sum + (Number(inv["amountPaid"]) || 0), 0);
    const balance = invoiced - paid;
    const hasOverdue = projectInvoices.some((inv) => {
      const due = inv["dueDate"] ? new Date(inv["dueDate"]) : null;
      const invOutstanding = (Number(inv["total"]) || 0) - (Number(inv["amountPaid"]) || 0);
      return due && due < now && inv["status"] !== "VOID" && inv["status"] !== "CANCELLED" && invOutstanding > 0;
    });
    const estCompletion = p["endDate"] ? new Date(p["endDate"]) : null;
    const pastCompletion =
      estCompletion && estCompletion < now && !["COMPLETED", "CLOSED", "CANCELLED"].includes(p["status"] ?? "");
    return { project: p, invoiced, paid, balance, hasOverdue, pastCompletion };
  });

  const attentionProjects = projectKpis.filter(
    (k) => k.hasOverdue || k.pastCompletion || k.balance > 0.01,
  );

  const visibleProjects = attentionOnly
    ? projectKpis.filter((k) => k.hasOverdue || k.pastCompletion).map((k) => k.project)
    : projects;

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
            <p className="text-xs text-muted-foreground mt-1">
              {t("scheduled")}: {projects["filter"]((p) => p["status"] === "SCHEDULED")["length"]} · {t("onHold")}: {onHoldProjects["length"]} · {t("completed")}: {completedProjects["length"]}
            </p>
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

      {/* Needs Attention strip */}
      {attentionProjects.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              {t("needsAttention")} ({attentionProjects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {attentionProjects.slice(0, 8).map((k) => {
                const reasons: string[] = [];
                if (k.hasOverdue) reasons.push(t("hasOverdue"));
                if (k.pastCompletion) reasons.push(t("pastCompletion"));
                else if (k.balance > 0.01) reasons.push(t("hasOutstanding"));
                return (
                  <Link
                    key={k.project["id"]}
                    href={`/dashboard/projects/${k.project["id"]}`}
                    className="rounded-md border bg-background px-3 py-2 text-xs hover:bg-accent"
                  >
                    <div className="font-medium">{k.project["name"]}</div>
                    <div className="text-muted-foreground">{reasons.join(" · ")}</div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3">
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
            <input type="hidden" name="type" value={typeFilter} />
            <input type="hidden" name="attention" value={attentionOnly ? "1" : ""} />
            <Button type="submit" size="sm" variant="outline">
              {tCommon("search")}
            </Button>
            {(query || statusFilter !== "all" || customerFilter !== "all" || typeFilter !== "all" || attentionOnly) && (
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/projects">×</Link>
              </Button>
            )}
          </form>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            name="status"
            defaultValue={statusFilter}
            onChange={(e) => {
              const url = new URLSearchParams(window.location.search);
              url.set("status", e.target.value);
              window.location.search = url.toString();
            }}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="all">{t("allStatuses")}</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>

          <select
            name="type"
            defaultValue={typeFilter}
            onChange={(e) => {
              const url = new URLSearchParams(window.location.search);
              url.set("type", e.target.value);
              window.location.search = url.toString();
            }}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="all">{t("allTypes")}</option>
            {PROJECT_TYPES.map((pt) => (
              <option key={pt} value={pt}>
                {PROJECT_TYPE_LABEL[pt as ProjectTypeKey]}
              </option>
            ))}
          </select>

          <select
            name="customer"
            defaultValue={customerFilter}
            onChange={(e) => {
              const url = new URLSearchParams(window.location.search);
              url.set("customer", e.target.value);
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

          <Button
            asChild={!attentionOnly}
            variant={attentionOnly ? "default" : "outline"}
            size="sm"
          >
            {attentionOnly ? (
              <Link href="/dashboard/projects">{t("allProjects")}</Link>
            ) : (
              <Link
                href={`/dashboard/projects?attention=1${query ? `&q=${encodeURIComponent(query)}` : ""}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}${customerFilter !== "all" ? `&customer=${customerFilter}` : ""}${typeFilter !== "all" ? `&type=${typeFilter}` : ""}`}
              >
                <AlertCircle className="mr-1 h-3 w-3" /> {t("attentionOnly")}
              </Link>
            )}
          </Button>
        </div>
      </div>

      {/* Projects Table */}
      <Card>
        <CardContent className="pt-6">
          {visibleProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {attentionOnly ? t("noAttention") : t("noProjects")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("projectType")}</TableHead>
                  <TableHead className="text-right">{t("contractValue")}</TableHead>
                  <TableHead className="text-right">{t("invoiced")}</TableHead>
                  <TableHead className="text-right">{t("paid")}</TableHead>
                  <TableHead className="text-right">{t("balance")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleProjects["map"]((p) => {
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
                      <TableCell className="text-xs text-muted-foreground">
                        {p["projectType"] ? PROJECT_TYPE_LABEL[p["projectType"] as ProjectTypeKey] ?? p["projectType"] : "—"}
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
