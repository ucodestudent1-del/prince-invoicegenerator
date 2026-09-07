"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BarChart3, Users, FileText, Download, Calendar, Clock, Wallet, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ReportsView() {
  const t = useTranslations("reports");
  const [activeTab, setActiveTab] = React["useState"]("revenue");
  const [year, setYear] = React["useState"](new Date()["getFullYear"]());
  const [revenueData, setRevenueData] = React["useState"]<any>(null);
  const [outstandingData, setOutstandingData] = React["useState"]<any>(null);
  const [taxesData, setTaxesData] = React["useState"]<any>(null);
  const [customersData, setCustomersData] = React["useState"]<any>(null);
  const [agingData, setAgingData] = React["useState"]<any>(null);
  const [projectsData, setProjectsData] = React["useState"]<any>(null);
  const [cashFlowData, setCashFlowData] = React["useState"]<any>(null);
  const [loading, setLoading] = React["useState"](false);

  const [error, setError] = React["useState"]<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "revenue" && !revenueData) {
        const res = await fetch(`/api/reports/revenue?year=${year}`);
        if (res["ok"]) setRevenueData(await res["json"]());
        else setError(t("failedRevenue"));
      }
      if (activeTab === "outstanding" && !outstandingData) {
        const res = await fetch("/api/reports/outstanding");
        if (res["ok"]) setOutstandingData(await res["json"]());
        else setError(t("failedOutstanding"));
      }
      if (activeTab === "taxes" && !taxesData) {
        const res = await fetch(`/api/reports/taxes?year=${year}`);
        if (res["ok"]) setTaxesData(await res["json"]());
        else setError(t("failedTaxes"));
      }
       if (activeTab === "customers" && !customersData) {
         const res = await fetch("/api/reports/customers");
         if (res["ok"]) setCustomersData(await res["json"]());
         else setError(t("failedCustomers"));
       }
       if (activeTab === "aging" && !agingData) {
         const res = await fetch("/api/reports/aging");
         if (res["ok"]) setAgingData(await res["json"]());
         else setError(t("failedAging"));
       }
       if (activeTab === "projects" && !projectsData) {
         const res = await fetch("/api/reports/project-financials");
         if (res["ok"]) setProjectsData(await res["json"]());
         else setError(t("failedProjects"));
       }
       if (activeTab === "cashFlow" && !cashFlowData) {
         const res = await fetch(`/api/reports/cash-flow?months=3`);
         if (res["ok"]) setCashFlowData(await res["json"]());
         else setError(t("failedCashFlow"));
       }
    } catch (err) {
      setError(t("failedGeneric"));
      console["error"]("Failed to load report data", err);
    } finally {
      setLoading(false);
    }
  }

  React["useEffect"](() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function exportData() {
    window["open"](`/api/export/invoices?format=csv`, "_blank");
  }

  const tabs = [
    { id: "revenue", label: t("revenue"), icon: BarChart3 },
    { id: "outstanding", label: t("outstanding"), icon: FileText },
    { id: "aging", label: t("aging"), icon: Clock },
    { id: "projects", label: t("projectFinancials"), icon: Wallet },
    { id: "cashFlow", label: t("cashFlow"), icon: BarChart3 },
    { id: "taxes", label: t("taxesCollected"), icon: Calendar },
    { id: "customers", label: t("customerAnalytics"), icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button variant="outline" size="sm" onClick={exportData}>
          <Download className="mr-2 h-4 w-4" /> {t("exportCsv")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs["map"]((tab) => (
          <Button
            key={tab["id"]}
            variant={activeTab === tab["id"] ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab["id"])}
          >
            <tab.icon className="mr-2 h-4 w-4" /> {tab["label"]}
          </Button>
        ))}
      </div>

      {activeTab === "revenue" && (
        <>
          <div className="flex items-center gap-4">
            <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setRevenueData(null); setTaxesData(null); }}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array["from"]({ length: 5 }, (_, i) => new Date()["getFullYear"]() - 2 + i)["map"]((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => { setRevenueData(null); loadData(); }}>
              {t("refresh")}
            </Button>
          </div>
          {loading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && !revenueData && (
            <p className="text-sm text-muted-foreground">{t("noRevenueData")}</p>
          )}
          {revenueData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("monthlyRevenue", { year: revenueData["year"] })}</CardTitle>
                <CardDescription>
                  {t("totalInvoiced", { total: formatCurrency(revenueData["annual"]["total"]), paid: formatCurrency(revenueData["annual"]["amountPaid"]), tax: formatCurrency(revenueData["annual"]["taxAmount"]) })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {revenueData["monthly"]["map"]((m: any) => (
                    <div key={m["month"]} className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-4">
                        <span className="w-20 text-sm">{m["month"]}</span>
                        <div className="flex-1 h-4 bg-muted rounded">
                          <div
                            className="h-4 bg-primary rounded"
                            style={{ width: `${Math["min"](100, (m["total"] / (revenueData["annual"]["total"] || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{formatCurrency(m["total"])}</span>
                        <div className="text-xs text-muted-foreground">
                          {t("invoiceCount", { count: m["count"] })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTab === "outstanding" && (
        <>
          {loading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && !outstandingData && (
            <p className="text-sm text-muted-foreground">{t("noOutstandingData")}</p>
          )}
          {outstandingData && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalOutstanding")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {formatCurrency(outstandingData["totalOutstanding"])}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("overdue")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {formatCurrency(outstandingData["totalOverdue"])}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("overdueInvoices")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {outstandingData["overdueCount"]}
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("outstandingInvoices")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2">{t("number")}</th>
                          <th className="py-2">{t("customer")}</th>
                          <th className="py-2">{t("dueDate")}</th>
                          <th className="py-2">{t("status")}</th>
                          <th className="py-2 text-right">{t("total")}</th>
                          <th className="py-2 text-right">{t("paid")}</th>
                          <th className="py-2 text-right">{t("balance")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outstandingData["invoices"]["map"]((inv: any) => (
                          <tr key={inv["id"]} className="border-b">
                            <td className="py-2">
                              <Link
                                href={`/dashboard/invoices/${inv["id"]}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {inv["number"]}
                              </Link>
                            </td>
                            <td>{inv["customerName"]}</td>
                            <td>{formatDate(inv["dueDate"])}</td>
                            <td>
                              <Badge variant={inv["status"] === "OVERDUE" ? "destructive" : "default"}>
                                {inv["status"]}
                              </Badge>
                            </td>
                            <td className="text-right">{formatCurrency(inv["total"], inv["currency"])}</td>
                            <td className="text-right">{formatCurrency(inv["amountPaid"], inv["currency"])}</td>
                            <td className="text-right font-medium text-orange-600">
                              {formatCurrency(inv["balance"], inv["currency"])}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {activeTab === "taxes" && (
        <>
          <div className="flex items-center gap-4">
            <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setTaxesData(null); }}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array["from"]({ length: 5 }, (_, i) => new Date()["getFullYear"]() - 2 + i)["map"]((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => { setTaxesData(null); loadData(); }}>
              {t("refresh")}
            </Button>
          </div>
          {loading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && !taxesData && (
            <p className="text-sm text-muted-foreground">{t("noTaxesData")}</p>
          )}
          {taxesData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("taxesCollectedYear", { year: taxesData["year"] })}</CardTitle>
                <CardDescription>
                  {t("totalTaxCollected", { amount: formatCurrency(taxesData["totalTaxCollected"]) })} · {t("invoiceCount", { count: taxesData["invoiceCount"] })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {taxesData["monthly"]["map"]((m: any) => (
                    <div key={m["month"]} className="flex items-center justify-between border-b pb-2">
                      <span className="w-20 text-sm">{m["month"]}</span>
                      <span className="font-medium">{formatCurrency(m["taxAmount"])}</span>
                      <span className="text-xs text-muted-foreground">{t("invoiceCount", { count: m["count"] })}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTab === "customers" && (
        <>
          {loading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && !customersData && (
            <p className="text-sm text-muted-foreground">{t("noCustomersData")}</p>
          )}
          {customersData && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalRevenue")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {formatCurrency(customersData["totalRevenue"])}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("customers")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {customersData["customerCount"]}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("activeCustomers")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {customersData["activeCustomerCount"]}
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("customerSpending")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2">{t("customer")}</th>
                          <th className="py-2 text-right">{t("invoices")}</th>
                          <th className="py-2 text-right">{t("totalInvoicedHeader")}</th>
                          <th className="py-2 text-right">{t("totalPaid")}</th>
                          <th className="py-2 text-right">{t("taxCollected")}</th>
                          <th className="py-2 text-right">{t("outstandingHeader")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customersData["customers"]["map"]((c: any) => (
                          <tr key={c["id"]} className="border-b">
                            <td>{c["name"]}</td>
                            <td className="text-right">{c["invoiceCount"]}</td>
                            <td className="text-right">{formatCurrency(c["totalInvoiced"])}</td>
                            <td className="text-right">{formatCurrency(c["totalPaid"])}</td>
                            <td className="text-right">{formatCurrency(c["totalTaxCollected"])}</td>
                            <td className="text-right font-medium">
                              {formatCurrency(c["outstanding"])}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {activeTab === "aging" && (
        <>
          {loading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && !agingData && (
            <p className="text-sm text-muted-foreground">{t("noAgingData")}</p>
          )}
          {agingData && (
            <>
              <div className="grid gap-4 sm:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalOutstanding")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {formatCurrency(agingData["totalOutstanding"], agingData["currency"])}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalOverdue")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold text-red-600">
                    {formatCurrency(agingData["totalOverdue"], agingData["currency"])}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("overdueInvoices")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {agingData["buckets"]?.["reduce"]?.((s: any, b: any) => s + b["count"], 0) ?? 0}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("unpaidInvoices")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {agingData["buckets"]?.["find"]?.((b: any) => b["label"] === "Not yet due")?.["count"] ?? 0}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("agingBuckets")}</CardTitle>
                  <CardDescription>{t("agingDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {agingData["buckets"]?.["map"]?.((bucket: any) => (
                      <div key={bucket["label"]} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{bucket["label"]}</span>
                          {bucket["invoices"]?.["length"] > 0 && (
                            <Badge variant={bucket["label"].includes("90+") ? "destructive" : bucket["label"].includes("61") || bucket["label"].includes("31") ? "default" : "secondary"}>
                              {bucket["count"]} invoices
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-bold">{formatCurrency(bucket["total"], agingData["currency"])}</span>
                        </div>
                        {bucket["invoices"]?.["length"] > 0 && bucket["invoices"]?.["length"] <= 5 && (
                          <div className="mt-2 space-y-1">
                            {bucket["invoices"].map((inv: any) => (
                              <div key={inv["id"]} className="flex items-center justify-between text-sm">
                                <Link
                                  href={`/dashboard/invoices/${inv["id"]}`}
                                  className="font-medium text-primary hover:underline"
                                >
                                  {inv["number"]}
                                </Link>
                                <span className="text-muted-foreground">
                                  {formatCurrency(inv["balance"], inv["currency"])} · {inv["daysOverdue"]} days overdue
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )) ?? []}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {activeTab === "projects" && (
        <>
          {loading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && !projectsData && (
            <p className="text-sm text-muted-foreground">{t("noProjectData")}</p>
          )}
          {projectsData && (
            <>
              <div className="grid gap-4 sm:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalContractValue")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {formatCurrency(projectsData["totals"]["totalContractValue"], projectsData["currency"])}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalInvoicedHeader")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {formatCurrency(projectsData["totals"]["totalInvoiced"], projectsData["currency"])}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalCollected")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {formatCurrency(projectsData["totals"]["totalCollected"], projectsData["currency"])}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalCosts")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold text-red-600">
                    {formatCurrency(projectsData["totals"]["totalCosts"], projectsData["currency"])}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("projectProfitability")}</CardTitle>
                  <CardDescription>
                    {t("grossMargin", { margin: projectsData["totals"]["grossMargin"]?.toFixed?.(1) ?? "0" })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2">{t("project")}</th>
                          <th className="py-2 text-right">{t("contractValue")}</th>
                          <th className="py-2 text-right">{t("totalInvoicedHeader")}</th>
                          <th className="py-2 text-right">{t("totalCollected")}</th>
                          <th className="py-2 text-right">{t("totalCosts")}</th>
                          <th className="py-2 text-right">{t("profit")}</th>
                          <th className="py-2 text-right">{t("status")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectsData["projects"]?.map?.((proj: any) => (
                          <tr key={proj["id"]} className="border-b">
                            <td className="py-2">
                              <Link
                                href={`/dashboard/projects/${proj["id"]}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {proj["name"]}
                              </Link>
                            </td>
                            <td className="py-2 text-right">{formatCurrency(proj["contractValue"], proj["currency"])}</td>
                            <td className="py-2 text-right">{formatCurrency(proj["totalInvoiced"], proj["currency"])}</td>
                            <td className="py-2 text-right">{formatCurrency(proj["amountPaid"], proj["currency"])}</td>
                            <td className="py-2 text-right">{formatCurrency(proj["totalExpenses"] + proj["totalTimeBillable"], proj["currency"])}</td>
                            <td className="py-2 text-right font-medium">
                              {formatCurrency(proj["amountPaid"] - proj["totalExpenses"] - proj["totalTimeBillable"], proj["currency"])}
                            </td>
                            <td className="py-2 text-right">
                              <Badge variant="outline">{proj["status"]}</Badge>
                            </td>
                          </tr>
                        )) ?? []}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {activeTab === "cashFlow" && (
        <>
          {loading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && !cashFlowData && (
            <p className="text-sm text-muted-foreground">{t("noCashFlowData")}</p>
          )}
          {cashFlowData && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("expectedInflows")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold text-green-600">
                    {formatCurrency(cashFlowData["totalExpectedInflows"], cashFlowData["currency"])}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("expectedOutflows")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold text-red-600">
                    {formatCurrency(cashFlowData["totalExpectedOutflows"], cashFlowData["currency"])}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("netCashFlow")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {formatCurrency(cashFlowData["netCashFlow"], cashFlowData["currency"])}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("cashFlowForecast")}</CardTitle>
                  <CardDescription>{t("cashFlowDescription", { months: 3 })}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {cashFlowData["periods"]?.map?.((period: any) => (
                      <div key={period["period"]} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{period["period"]}</span>
                          <Badge variant={period["netCashFlow"] >= 0 ? "default" : "destructive"}>
                            {period["netCashFlow"] >= 0 ? "+" : ""}{formatCurrency(period["netCashFlow"], cashFlowData["currency"])}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Inflows:</span> {formatCurrency(period["expectedInflows"], cashFlowData["currency"])}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Outflows:</span> {formatCurrency(period["expectedOutflows"], cashFlowData["currency"])}
                          </div>
                          <div className="text-right">
                            <span className="text-muted-foreground">Cumulative:</span> {formatCurrency(period["cumulative"], cashFlowData["currency"])}
                          </div>
                        </div>
                        {period["invoices"]?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {period["invoices"].map((inv: any) => (
                              <div key={inv["number"]} className="flex items-center justify-between text-xs text-muted-foreground">
                                <Link
                                  href={`/dashboard/invoices/${inv["id"] ?? ""}`}
                                  className="text-primary hover:underline"
                                >
                                  {inv["number"]}
                                </Link>
                                <span>
                                  {formatCurrency(inv["amount"], cashFlowData["currency"])} · Due {formatDate(inv["dueDate"])}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )) ?? []}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
