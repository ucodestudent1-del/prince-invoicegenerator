"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ProjectFinancials } from "@/lib/project-financials";

interface FinancialCardsProps {
  financials: ProjectFinancials;
}

export function ProjectFinancialCards({ financials }: FinancialCardsProps) {
  const cards = [
    {
      label: "Original Contract",
      value: formatCurrency(financials.originalContractValue, financials.currency),
      subtitle: "",
      highlight: false,
    },
    {
      label: "Approved Change Orders",
      value: formatCurrency(financials.approvedChangeOrders, financials.currency),
      subtitle: financials.approvedChangeOrders > 0 ? "+ change orders" : "",
      highlight: false,
    },
    {
      label: "Current Contract Value",
      value: formatCurrency(financials.currentContractValue, financials.currency),
      subtitle: "contract - approved COs",
      highlight: true,
    },
    {
      label: "Total Invoiced",
      value: formatCurrency(financials.totalInvoiced, financials.currency),
      subtitle: "",
      highlight: false,
    },
    {
      label: "Total Paid",
      value: formatCurrency(financials.totalCollected, financials.currency),
      subtitle: "",
      highlight: false,
    },
    {
      label: "Outstanding Balance",
      value: formatCurrency(financials.outstandingBalance, financials.currency),
      subtitle: "",
      highlight: true,
      negative: financials.outstandingBalance > 0,
    },
    {
      label: "Project Costs",
      value: formatCurrency(financials.projectCosts, financials.currency),
      subtitle: "",
      highlight: false,
    },
    {
      label: "Gross Profit",
      value: formatCurrency(financials.grossProfit, financials.currency),
      subtitle: financials.grossMargin > 0 ? `${financials.grossMargin.toFixed(1)}% margin` : "",
      highlight: financials.grossProfit > 0,
      positive: financials.grossProfit > 0,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards["map"]((card) => (
        <Card key={card["label"]} className={card["highlight"] ? "ring-1 ring-primary/20" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {card["label"]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                card["positive"]
                  ? "text-emerald-600"
                  : card["negative"]
                  ? "text-red-600"
                  : card["highlight"]
                  ? "text-primary"
                  : ""
              }`}
            >
              {card["value"]}
            </div>
            {card["subtitle"] && (
              <p className="text-xs text-muted-foreground mt-1">{card["subtitle"]}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
