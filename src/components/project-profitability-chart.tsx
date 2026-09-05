"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { ProjectFinancials } from "@/lib/project-financials";

interface ProfitabilityChartProps {
  financials: ProjectFinancials;
  t: any;
}

/**
 * Visual breakdown of how the project's money flows. Shows the relationship
 * between revenue (invoiced), costs (actual + projected remaining), and
 * profit (estimated vs actual vs projected).
 */
export function ProfitabilityChart({ financials, t }: ProfitabilityChartProps) {
  const { currentContractValue, actualCosts, projectedCosts, estimatedCost, grossProfit, estimatedProfit, projectedProfit, totalInvoiced, currency } = financials;

  const rows: { label: string; value: number; tone: string; note?: string }[] = [
    {
      label: t("currentContractValue"),
      value: currentContractValue,
      tone: "bg-blue-500",
      note: t("contractNote"),
    },
    {
      label: t("totalInvoiced"),
      value: totalInvoiced,
      tone: "bg-blue-300",
      note: t("invoicedNote"),
    },
    {
      label: t("actualCosts"),
      value: actualCosts,
      tone: "bg-amber-500",
      note: t("actualCostsNote"),
    },
    {
      label: t("projectedCosts"),
      value: projectedCosts,
      tone: "bg-amber-300",
      note: t("projectedCostsNote"),
    },
    {
      label: t("estimatedCost"),
      value: estimatedCost,
      tone: "bg-amber-200",
      note: t("estimatedCostNote"),
    },
  ];

  // Profit summary cards
  const profitCards = [
    {
      label: t("estimatedProfit"),
      value: estimatedProfit,
      hint: estimatedCost > 0 ? `${financials.estimatedMargin.toFixed(1)}%` : "—",
      tone: estimatedProfit >= 0 ? "text-emerald-600" : "text-red-600",
    },
    {
      label: t("actualCosts"),
      value: grossProfit,
      hint: financials.grossMargin > 0 ? `${financials.grossMargin.toFixed(1)}%` : "—",
      tone: grossProfit >= 0 ? "text-emerald-600" : "text-red-600",
    },
    {
      label: t("projectedProfit"),
      value: projectedProfit,
      hint: financials.projectedMargin > 0 ? `${financials.projectedMargin.toFixed(1)}%` : "—",
      tone: projectedProfit >= 0 ? "text-emerald-600" : "text-red-600",
    },
  ];

  const maxValue = Math.max(...rows.map((r) => r.value), currentContractValue, 1);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profitability")}</CardTitle>
          <CardDescription>{t("profitabilityDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rows.map((row) => {
              const width = maxValue > 0 ? Math.max(2, (row.value / maxValue) * 100) : 0;
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{row.label}</span>
                    <span className="text-muted-foreground">{formatCurrency(row.value, currency)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div className={`h-3 rounded-full ${row.tone}`} style={{ width: `${width}%` }} />
                  </div>
                  {row.note && <p className="text-xs text-muted-foreground">{row.note}</p>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {profitCards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-xl font-bold ${c.tone}`}>{formatCurrency(c.value, currency)}</div>
              <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
