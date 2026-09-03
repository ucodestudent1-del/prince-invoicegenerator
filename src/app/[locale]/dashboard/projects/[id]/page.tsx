import { Link, redirect } from "@/i18n/navigation";
import { requireUser, requireFeature } from "@/lib/org";
import { db } from "@/lib/db";
import {
  getProjectDetail,
  getProjectFinancials,
  getProjectInvoices,
  getProjectPayments,
  getProjectExpenses,
  getProjectChangeOrders,
} from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ProjectFinancialCards } from "@/components/project-financial-cards";
import { ProjectStatusBadge } from "@/components/project-status-badge";
import { EditProjectForm } from "@/components/project-edit-form";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  Plus,
  Printer,
  Download,
} from "lucide-react";
import { Suspense } from "react";

const TAB_VALUES = ["overview", "invoices", "payments", "costs", "changeOrders", "documents", "settings"] as const;

export const dynamic = "force-dynamic";

export default async function ProjectWorkspacePage({
  params,
  searchParams,
}: {
  params: { id: string; locale: string };
  searchParams: { tab?: string };
}) {
  await requireFeature("projectManagement");
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];
  const t = await getTranslations("projects");
  const tCommon = await getTranslations("common");
  const tInvoices = await getTranslations("invoices");
  const tPayments = await getTranslations("payments");
  const tExpenses = await getTranslations("expenses");

  const activeTab = (searchParams["tab"] ?? "overview") as string;
  const validTab = TAB_VALUES["includes"](activeTab as any)
    ? activeTab
    : "overview";

  let project;
  let financials;
  let invoices;
  let payments;
  let expenses;
  let changeOrders;

  try {
    [project, financials, invoices, payments, expenses, changeOrders] = await Promise["all"]([
      getProjectDetail(params["id"]),
      getProjectFinancials(params["id"]),
      getProjectInvoices(params["id"]),
      getProjectPayments(params["id"]),
      getProjectExpenses(params["id"]),
      getProjectChangeOrders(params["id"]),
    ]);
  } catch (err) {
    logServerError("ProjectWorkspacePage", err);
    throw err;
  }

  if (!project) {
    redirect({ href: "/dashboard/projects", locale: params["locale"] });
    throw new Error("Unreachable: redirect should have exited");
  }

  // Fetch customers for the edit form
  let customers: { id: string; name: string }[] = [];
  try {
    customers = await db["customer"]["findMany"]({
      where: { orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } catch (err) {
    // If customer table has issues, the edit form still works without customers
  }

  const now = new Date();
  const issueDate = project["startDate"] ? new Date(project["startDate"]) : null;
  const completionDate = project["endDate"] ? new Date(project["endDate"]) : null;
  const totalDays = issueDate && completionDate ? Math["ceil"]((completionDate["getTime"]() - issueDate["getTime"]()) / (1000 * 60 * 60 * 24)) : 0;
  const daysElapsed = issueDate && totalDays > 0 ? Math["min"](totalDays, Math["floor"]((now["getTime"]() - issueDate["getTime"]()) / (1000 * 60 * 60 * 24))) : 0;
  const progressPercent = totalDays > 0 ? Math["round"]((daysElapsed / totalDays) * 100) : 0;

  const customerName =
    (project as any)["customer"]?.["name"] ||
    (project as any)["customer"]?.["company"] ||
    "—";
  const currency = financials["currency"];

  const activeInvoices = (invoices as any[])["filter"]((inv) => inv["status"] !== "VOID" && inv["status"] !== "CANCELLED");
  const invoicesTotal = activeInvoices["reduce"]((sum: number, inv: any) => sum + (Number(inv["total"]) || 0), 0);
  const invoicesPaid = activeInvoices["reduce"]((sum: number, inv: any) => sum + (Number(inv["amountPaid"] || 0)), 0);
  const invoicesOutstanding = invoicesTotal - invoicesPaid;

  const overdueInvoices = activeInvoices["filter"]((inv: any) => {
    const due = inv["dueDate"] ? new Date(inv["dueDate"]) : null;
    return due && due < now && (Number(inv["total"]) - Number(inv["amountPaid"] || 0)) > 0.01;
  });
  const overdueAmount = overdueInvoices["reduce"](
    (sum: number, inv: any) => sum + (Number(inv["total"]) - Number(inv["amountPaid"] || 0)),
    0
  );

  const expensesTotal = expenses["reduce"]((sum: number, exp: any) => sum + (Number(exp["amount"]) || 0), 0);
  const paymentsTotal = payments["reduce"]((sum: number, p: any) => sum + (Number(p["amount"]) || 0), 0);

  const changeOrderTotal = changeOrders["reduce"](
    (sum: number, co: any) => sum + (Number(co["changeAmount"]) || 0),
    0
  );
  const approvedChangeOrders = changeOrders["filter"]((co: any) => co["status"] === "APPROVED");

  const statusVariant: Record<string, any> = {
    DRAFT: "secondary",
    SENT: "default",
    VIEWED: "outline",
    PAID: "success",
    PARTIALLY_PAID: "default",
    UNPAID: "outline",
    OVERDUE: "destructive",
    VOID: "outline",
  };

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/projects">
              <ArrowLeft className="mr-2 h-4 w-4" /> {t("back")}
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{project["name"] || project["number"] || "—"}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/projects/${project["id"]}/print`} target="_blank">
              <Printer className="mr-2 h-4 w-4" /> {t("exportPdf")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/documents/projects/${project["id"]}/pdf`} download>
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </a>
          </Button>
          <Button asChild size="sm">
            <Link href={`/dashboard/invoices/new?projectId=${project["id"]}`}>
              <Plus className="mr-2 h-4 w-4" /> {t("createInvoice")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Project meta */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">
                {t("jobAddress")}
              </p>
              <p className="text-sm">{project["address"] || "—"}</p>
            </div>
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider text-gray-400 mb-1">
                {t("customer")}
              </p>
              <p className="text-sm">{customerName}</p>
            </div>
          </div>
          {project["number"] && (
            <p className="text-sm text-muted-foreground mt-2">
              <span className="font-medium">{t("projectNumber")}:</span> {project["number"]}
            </p>
          )}
          <div className="mt-3">
            <ProjectStatusBadge status={project["status"] ?? "ACTIVE"} />
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary Cards */}
      <ProjectFinancialCards financials={financials} />

      {/* Progress indicator */}
      {totalDays > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("projectProgress")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{daysElapsed} days elapsed</span>
                <span>{totalDays} days total</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-right text-sm font-medium">{progressPercent}% complete</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Tabs">
          {TAB_VALUES["map"]((tab) => {
            const isActive = tab === validTab;
            let label: string;
            if (tab === "overview") label = t("overview");
            else if (tab === "invoices") label = tInvoices("title");
            else if (tab === "payments") label = tPayments("title");
            else if (tab === "costs") label = tExpenses("title");
            else if (tab === "changeOrders") label = "Change Orders";
            else if (tab === "documents") label = t("documents");
            else label = "Settings";

            return (
              <Link
                key={tab}
                href={`?tab=${tab}`}
                className="px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
                style={{
                  borderBottomColor: isActive ? "var(--primary-foreground)" : "transparent",
                  color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <TabContent
        activeTab={validTab}
        project={project}
        financials={financials}
        invoices={invoices}
        payments={payments}
        expenses={expenses}
        changeOrders={changeOrders}
        currency={currency}
        customers={customers}
        invoicesTotal={invoicesTotal}
        invoicesPaid={invoicesPaid}
        invoicesOutstanding={invoicesOutstanding}
        overdueAmount={overdueAmount}
        expensesTotal={expensesTotal}
        paymentsTotal={paymentsTotal}
        changeOrderTotal={changeOrderTotal}
        approvedChangeOrders={approvedChangeOrders}
        activeInvoices={activeInvoices}
        overdueInvoices={overdueInvoices}
        statusVariant={statusVariant}
        t={t}
        tInvoices={tInvoices}
        tPayments={tPayments}
        tExpenses={tExpenses}
        tCommon={tCommon}
      />
    </div>
  );
}

function TabContent({
  activeTab,
  project,
  financials,
  invoices,
  payments,
  expenses,
  changeOrders,
  currency,
  customers,
  invoicesTotal,
  invoicesPaid,
  invoicesOutstanding,
  overdueAmount,
  expensesTotal,
  paymentsTotal,
  changeOrderTotal,
  approvedChangeOrders,
  activeInvoices,
  overdueInvoices,
  statusVariant,
  t,
  tInvoices,
  tPayments,
  tExpenses,
  tCommon,
}: {
  activeTab: string;
  project: any;
  financials: any;
  invoices: any[];
  payments: any[];
  expenses: any[];
  changeOrders: any[];
  currency: string;
  customers: { id: string; name: string }[];
  invoicesTotal: number;
  invoicesPaid: number;
  invoicesOutstanding: number;
  overdueAmount: number;
  expensesTotal: number;
  paymentsTotal: number;
  changeOrderTotal: number;
  approvedChangeOrders: any[];
  activeInvoices: any[];
  overdueInvoices: any[];
  statusVariant: Record<string, any>;
  t: any;
  tInvoices: any;
  tPayments: any;
  tExpenses: any;
  tCommon: any;
}) {
  return (
    <>
      {/* Overview Tab */}
      <div className={activeTab === "overview" ? "block" : "hidden"}>
        <div className="grid gap-6 lg:grid-cols-2">
        {/* Contract Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("contractInformation")}</CardTitle>
            <CardDescription>{tCommon("details")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">{t("contractValue")}:</span>{" "}
              {formatCurrency(financials["originalContractValue"], currency)}
            </div>
            <div>
              <span className="font-medium text-muted-foreground">{t("paymentTerms")}:</span>{" "}
              {project["paymentTerms"] ?? "NET_30"}
            </div>
            <div>
              <span className="font-medium text-muted-foreground">{t("taxRate")}:</span>{" "}
              {project["taxRate"] ?? 0}%
            </div>
            <div>
              <span className="font-medium text-muted-foreground">{t("retainageRate")}:</span>{" "}
              {project["retainageRate"] ?? 0}%
            </div>
            {project["depositRequired"] > 0 && (
              <div>
                <span className="font-medium text-muted-foreground">{t("depositRequired")}:</span>{" "}
                {formatCurrency(project["depositRequired"], currency)}
              </div>
            )}
            {project["projectManager"] && (
              <div>
                <span className="font-medium text-muted-foreground">{t("projectManager")}:</span>{" "}
                {project["projectManager"]}
              </div>
            )}
            <div>
              <span className="font-medium text-muted-foreground">{t("startDate")}:</span>{" "}
              {formatDate(project["startDate"])}
            </div>
            <div>
              <span className="font-medium text-muted-foreground">{t("endDate")}:</span>{" "}
              {formatDate(project["endDate"])}
            </div>
            <div>
              <span className="font-medium text-muted-foreground">{t("estCompletionDate")}:</span>{" "}
              {formatDate(project["estCompletionDate"])}
            </div>
          </CardContent>
        </Card>

        {/* Billing Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("billingInformation")}</CardTitle>
            <CardDescription>{tCommon("details")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Current Contract Value:</span>{" "}
              {formatCurrency(financials["currentContractValue"], currency)}
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Total Invoiced:</span>{" "}
              {formatCurrency(invoicesTotal, currency)}
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Total Paid:</span>{" "}
              {formatCurrency(invoicesPaid, currency)}
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Outstanding Balance:</span>{" "}
              <span className="font-bold">{formatCurrency(invoicesOutstanding, currency)}</span>
            </div>
            {overdueAmount > 0 && (
              <div>
                <span className="font-medium text-muted-foreground">Overdue:</span>{" "}
                <span className="text-red-600 font-bold">{formatCurrency(overdueAmount, currency)}</span>
              </div>
            )}
            <div>
              <span className="font-medium text-muted-foreground">Remaining Work Value:</span>{" "}
              {formatCurrency(financials["currentContractValue"] - invoicesTotal, currency)}
            </div>
          </CardContent>
        </Card>

        {/* Project Costs / Profit */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("costsProfit")}</CardTitle>
            <CardDescription>{tCommon("details")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">{t("projectCosts")}:</span>{" "}
              {formatCurrency(expensesTotal, currency)}
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Total Collected:</span>{" "}
              {formatCurrency(paymentsTotal + (financials["depositPaid"] || 0), currency)}
            </div>
            <div className="border-t pt-2 mt-2">
              <span className="font-medium text-muted-foreground">{t("grossProfit")}:</span>{" "}
              <span
                className={financials["grossProfit"] >= 0 ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}
              >
                {formatCurrency(financials["grossProfit"], currency)}
              </span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">{t("grossMargin")}:</span>{" "}
              {financials["grossMargin"]}%
            </div>
          </CardContent>
        </Card>

        {/* Change Orders Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change Orders</CardTitle>
            <CardDescription>{tCommon("details")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Approved Change Orders:</span>{" "}
              {approvedChangeOrders["length"]} ({formatCurrency(financials["approvedChangeOrders"], currency)})
            </div>
            <div>
              <span className="font-medium text-muted-foreground">All Changes:</span>{" "}
              {changeOrders["length"]} ({formatCurrency(changeOrderTotal, currency)})
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {invoices["length"] > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Latest invoice {invoices[0]["number"]} for {formatCurrency(invoices[0]["total"], currency)}
                </span>
                <span className="text-muted-foreground">{formatDate(invoices[0]["createdAt"])}</span>
              </div>
            )}
            {expenses["length"] > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Latest expense: {expenses[0]["vendor"] ?? "Expense"} for {formatCurrency(expenses[0]["amount"], currency)}
                </span>
                <span className="text-muted-foreground">{formatDate(expenses[0]["createdAt"])}</span>
              </div>
            )}
            {changeOrders["length"] > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Latest change order {changeOrders[0]["number"]} — {changeOrders[0]["status"]}
                </span>
                <span className="text-muted-foreground">{formatDate(changeOrders[0]["createdAt"])}</span>
              </div>
            )}
            {invoices["length"] === 0 && expenses["length"] === 0 && changeOrders["length"] === 0 && (
              <p className="text-muted-foreground">No activity yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Invoices Tab */}
      <div className={activeTab === "invoices" ? "block" : "hidden"}>
        {invoices["length"] === 0 ? (
          <p className="text-muted-foreground">{tInvoices("noInvoices")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tInvoices("number")}</TableHead>
                <TableHead>{tInvoices("date")}</TableHead>
                <TableHead className="text-right">{tInvoices("total")}</TableHead>
                <TableHead className="text-right">{tInvoices("paid")}</TableHead>
                <TableHead className="text-right">{tInvoices("balance")}</TableHead>
                <TableHead>{tCommon("status")}</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices["map"]((inv: any) => (
                <TableRow key={inv["id"]}>
                  <TableCell className="font-medium">{inv["number"]}</TableCell>
                  <TableCell>{formatDate(inv["issueDate"])}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(inv["total"]) || 0, currency)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(inv["amountPaid"]) || 0, currency)}</TableCell>
                  <TableCell className="text-right">{formatCurrency((Number(inv["total"]) || 0) - (Number(inv["amountPaid"]) || 0), currency)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[inv["status"]] ?? "secondary"}>{inv["status"]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/dashboard/invoices/${inv["id"]}`} className="text-sm underline">
                      {tCommon("view")}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Payments Tab */}
      <div className={activeTab === "payments" ? "block" : "hidden"}>
        {payments["length"] === 0 ? (
          <p className="text-muted-foreground">{tPayments("noPayments")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tPayments("date") ?? "Date"}</TableHead>
                <TableHead className="text-right">{tPayments("amount") ?? "Amount"}</TableHead>
                <TableHead>{tPayments("method") ?? "Method"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments["map"]((p: any) => (
                <TableRow key={p["id"]}>
                  <TableCell>{formatDate(p["date"])}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(p["amount"]) || 0, currency)}</TableCell>
                  <TableCell>{p["method"] || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Costs Tab */}
      <div className={activeTab === "costs" ? "block" : "hidden"}>
        {expenses["length"] === 0 ? (
          <p className="text-muted-foreground">{tExpenses("noExpenses")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tExpenses("date")}</TableHead>
                <TableHead>{tExpenses("category") ?? "Category"}</TableHead>
                <TableHead className="text-right">{tExpenses("amount") ?? "Amount"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses["map"]((exp: any) => (
                <TableRow key={exp["id"]}>
                  <TableCell>{formatDate(exp["date"])}</TableCell>
                  <TableCell>{exp["category"] || "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(exp["amount"]) || 0, currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Change Orders Tab */}
      <div className={activeTab === "changeOrders" ? "block" : "hidden"}>
        {changeOrders["length"] === 0 ? (
          <p className="text-muted-foreground">No change orders yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changeOrders["map"]((co: any) => (
                <TableRow key={co["id"]}>
                  <TableCell className="font-medium">{co["number"] ?? co["id"]}</TableCell>
                  <TableCell>{formatDate(co["createdAt"])}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(co["changeAmount"]) || 0, currency)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[co["status"]] ?? "secondary"}>{co["status"]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Documents Tab */}
      <div className={activeTab === "documents" ? "block" : "hidden"}>
        <p className="text-muted-foreground">No documents yet.</p>
      </div>

      {/* Settings Tab */}
      <div className={activeTab === "settings" ? "block" : "hidden"}>
        <EditProjectForm
          projectId={project["id"]}
          initial={{
            name: project["name"] ?? "",
            number: project["number"] ?? null,
            address: project["address"] ?? null,
            customerId: project["customerId"] ?? project["customer"]?.["id"] ?? null,
            startDate: project["startDate"] ?? null,
            endDate: project["endDate"] ?? null,
            estCompletionDate: project["estCompletionDate"] ?? null,
            contractValue: Number(project["contractValue"]) || 0,
            paymentTerms: project["paymentTerms"] ?? "NET_30",
            taxRate: Number(project["taxRate"]) || 0,
            retainageRate: Number(project["retainageRate"]) || 0,
            depositRequired: Number(project["depositRequired"]) || 0,
            projectManager: project["projectManager"] ?? null,
            status: project["status"] ?? "ACTIVE",
          }}
          customers={customers}
        />
      </div>
    </>
  );
}
