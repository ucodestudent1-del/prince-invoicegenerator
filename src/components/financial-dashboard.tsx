"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Download, TrendingUp, Clock, Receipt } from "lucide-react";
import type { FinancialDashboardData } from "@/lib/actions/reports";

export function FinancialDashboard() {
  const t = useTranslations("reports");
  const [data, setData] = React["useState"]<FinancialDashboardData | null>(null);
  const [loading, setLoading] = React["useState"](true);
  const [searchQuery, setSearchQuery] = React["useState"]("");

  React["useEffect"](() => {
    async function loadData() {
      try {
        const res = await fetch("/api/reports/financial-dashboard");
        if (res["ok"]) {
          const result = await res["json"]();
          setData(result);
        }
      } catch (err) {
        console["error"]("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleExport = () => {
    window["open"](`/api/export/invoices?format=csv`, "_blank");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4]["map"]((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-8 bg-muted animate-pulse rounded mb-2"></div>
                <div className="h-6 bg-muted animate-pulse rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Failed to load dashboard data.</p>;
  }

  const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | null | undefined> = {
    DRAFT: "secondary",
    SENT: "default",
    VIEWED: "outline",
    PAID: "success",
    PARTIALLY_PAID: "default",
    UNPAID: "outline",
    OVERDUE: "destructive",
    VOID: "outline",
  };

  const filteredInvoices = data["invoices"]["filter"]((inv) =>
    inv["customerName"]["toLowerCase"]()["includes"](searchQuery["toLowerCase"]()) ||
    inv["number"]["toLowerCase"]()["includes"](searchQuery["toLowerCase"]())
  );

  const maxRevenueValue = Math["max"](0, ...data["revenueOverTime"]["map"]((d) => d["total"]), 1);
  const maxBarValue = Math["max"](
    data["paidVsOutstanding"]["paid"],
    data["paidVsOutstanding"]["outstanding"],
    1
  );
  const maxOverdueValue = Math["max"](0, ...data["overdueBreakdown"]["map"]((d) => d["amount"]), 1);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalRevenue")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(data["kpis"]["totalRevenue"])}
            </div>
            <p className="text-xs text-muted-foreground">
              Total invoiced across all customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("outstandingBalance")}</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(data["kpis"]["outstandingBalance"])}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently owed by customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("overdueAmount")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(data["kpis"]["overdueAmount"])}
            </div>
            <p className="text-xs text-muted-foreground">
              {data["overdueBreakdown"]["length"]} overdue invoice(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("paidThisMonth")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(data["kpis"]["paidThisMonth"])}
            </div>
            <p className="text-xs text-muted-foreground">
              Payments received this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("revenueOverTime")}</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {data["revenueOverTime"]["length"] > 0 ? (
                <div className="h-full w-full flex items-end gap-1">
                  {data["revenueOverTime"]["map"]((d, i) => {
                    const heightPct = maxRevenueValue > 0
                      ? Math["max"]((d["total"] / maxRevenueValue) * 100, d["total"] > 0 ? 2 : 0)
                      : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center h-full justify-end">
                        <div
                          className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors"
                          style={{ height: `${heightPct}%`, minHeight: d["total"] > 0 ? "4px" : "0" }}
                          title={`${d["date"]}: ${formatCurrency(d["total"])}`}
                        />
                        <span className="text-[8px] text-muted-foreground rotate-[-45deg] mt-1">
                          {d["date"]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No data available.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Paid vs Outstanding */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("paidVsOutstanding")}</CardTitle>
            <CardDescription>Current period snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-4">
                <span className="w-12 text-sm font-medium text-emerald-700">Paid</span>
                <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded transition-all duration-500"
                    style={{
                      width: `${(data["paidVsOutstanding"]["paid"] / maxBarValue) * 100}%`,
                      minWidth: "2px",
                    }}
                  />
                </div>
                <span className="w-32 text-sm font-medium text-right">
                  {formatCurrency(data["paidVsOutstanding"]["paid"])}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="w-12 text-sm font-medium text-amber-700">Outstanding</span>
                <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded transition-all duration-500"
                    style={{
                      width: `${(data["paidVsOutstanding"]["outstanding"] / maxBarValue) * 100}%`,
                      minWidth: "2px",
                    }}
                  />
                </div>
                <span className="w-32 text-sm font-medium text-right">
                  {formatCurrency(data["paidVsOutstanding"]["outstanding"])}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Overdue Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("overdueBreakdown")}</CardTitle>
            <CardDescription>Sorted by days overdue</CardDescription>
          </CardHeader>
          <CardContent>
            {data["overdueBreakdown"]["length"] === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noOverdue")}</p>
            ) : (
              <div className="space-y-3 pt-2">
                {data["overdueBreakdown"]["slice"](0, 8)["map"]((item, i) => {
                  const barWidth = (item["amount"] / maxOverdueValue) * 100;
                  return (
                    <div key={`${item["invoiceNumber"]}-${i}`} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item["customerName"]}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(item["amount"])} · {item["daysOverdue"]}d overdue
                        </span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded"
                          style={{ width: `${barWidth}%`, minWidth: "2px" }}
                        />
                      </div>
                    </div>
                  );
                })}
                {data["overdueBreakdown"]["length"] > 8 && (
                  <p className="text-xs text-muted-foreground">
                    +{data["overdueBreakdown"]["length"] - 8} more overdue invoices
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Customer (Donut Chart using CSS conic-gradient) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("revenueByCustomer")}</CardTitle>
            <CardDescription>Top 5 customers + others</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative w-28 h-28">
                {data["revenueByCustomer"]["length"] > 0 ? (
                  <div
                    className="w-full h-full rounded-full"
                    style={{
                      background: `conic-gradient(${data["revenueByCustomer"]
                        ["map"](
                          (c, i, arr) =>
                            `${c["color"]} ${i === 0 ? "0%" : `${(arr["slice"](0, i)["reduce"]((s, x) => s + x["amount"], 0) / (data["revenueByCustomer"]["reduce"]((s, x) => s + x["amount"], 0) || 1)) * 100}%`} ` +
                            `${((arr["slice"](0, i + 1)["reduce"]((s, x) => s + x["amount"], 0)) / (data["revenueByCustomer"]["reduce"]((s, x) => s + x["amount"], 0) || 1)) * 100}%`
                        )
                        ["join"](", ")})`
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 rounded-full" />
                )}
              </div>
              <div className="space-y-1.5">
                {data["revenueByCustomer"]["map"]((c, i) => (
                  <div key={c["name"]} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: c["color"] }}
                    />
                    <span className="text-sm">{c["name"]}</span>
                    <span className="text-sm font-medium text-muted-foreground">
                      {formatCurrency(c["amount"])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Management Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t("invoiceManagement")}</CardTitle>
              <CardDescription>
                {filteredInvoices["length"]} of {data["invoices"]["length"]} invoices
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e["target"]["value"])}
                className="w-48"
              />
              <Select defaultValue="all">
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoiceId")}</TableHead>
                <TableHead>{t("customerName")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead>{t("dueDate")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices["length"] === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <p className="text-sm text-muted-foreground">{t("noInvoices")}</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices["slice"](0, 15)["map"]((inv) => (
                  <TableRow key={inv["id"]}>
                    <TableCell className="font-medium">{inv["number"]}</TableCell>
                    <TableCell>{inv["customerName"]}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(inv["amount"])}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{formatDate(inv["dueDate"])}</span>
                        {inv["daysOverdue"] > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {inv["daysOverdue"]}d
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[inv["status"]] ?? "secondary"}>
                        {inv["status"]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {filteredInvoices["length"] > 15 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              {filteredInvoices["length"] - 15} more invoices not shown
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
