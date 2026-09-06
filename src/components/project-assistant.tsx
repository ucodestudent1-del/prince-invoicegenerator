import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, TrendingDown, Clock, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ProjectAssistantProps {
  financials: any;
  invoices: any[];
  changeOrders: any[];
  project: any;
  activeInvoices: any[];
  t: any;
  currency: string;
}

export function ProjectAssistant({
  financials,
  invoices,
  changeOrders,
  project,
  activeInvoices,
  t,
  currency,
}: ProjectAssistantProps) {
  const items: { icon: any; title: string; body: string; tone: string }[] = [];

  // Overdue invoices
  const overdueCount = activeInvoices.filter((inv: any) => {
    const due = inv["dueDate"] ? new Date(inv["dueDate"]) : null;
    const now = new Date();
    return due && due < now && (Number(inv["total"]) - Number(inv["amountPaid"] || 0)) > 0.01;
  }).length;
  if (overdueCount > 0) {
    items.push({
      icon: AlertCircle,
      title: t("assistantOverdue", { count: overdueCount }),
      body: t("assistantOverdue", { count: overdueCount }),
      tone: "bg-red-50 border-red-200",
    });
  }

  // Pending change orders
  const pendingCO = changeOrders.filter(
    (co: any) => co["status"] === "PENDING_APPROVAL" || co["status"] === "DRAFT" || co["status"] === "SENT"
  ).length;
  if (pendingCO > 0) {
    items.push({
      icon: FileText,
      title: t("assistantPendingCO", { count: pendingCO }),
      body: t("assistantPendingCO", { count: pendingCO }),
      tone: "bg-amber-50 border-amber-200",
    });
  }

  // Past completion
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const estCompletion = project?.["estCompletionDate"] ? new Date(project["estCompletionDate"]) : null;
  if (estCompletion && estCompletion < today && project["status"] !== "COMPLETED" && project["status"] !== "CLOSED") {
    items.push({
      icon: Clock,
      title: t("assistantPastCompletion"),
      body: t("assistantPastCompletion"),
      tone: "bg-amber-50 border-amber-200",
    });
  }

  // No invoicing
  if (activeInvoices.length === 0) {
    items.push({
      icon: AlertCircle,
      title: t("assistantNoInvoicing"),
      body: t("assistantNoInvoicing"),
      tone: "bg-blue-50 border-blue-200",
    });
  }

  // Below margin
  const projectedMargin = financials["projectedProfit"] && financials["currentContractValue"]
    ? (financials["projectedProfit"] / financials["currentContractValue"]) * 100
    : 0;
  if (projectedMargin < 20 && financials["currentContractValue"] > 0) {
    items.push({
      icon: TrendingDown,
      title: t("assistantBelowMargin"),
      body: t("assistantBelowMargin"),
      tone: "bg-red-50 border-red-200",
    });
  }

  // High outstanding
  const outstanding = financials["outstandingBalance"] ?? 0;
  const contractValue = financials["currentContractValue"] ?? 0;
  if (contractValue > 0 && outstanding > contractValue * 0.5) {
    items.push({
      icon: AlertCircle,
      title: t("assistantHighOutstanding"),
      body: t("assistantHighOutstanding"),
      tone: "bg-amber-50 border-amber-200",
    });
  }

  if (items.length === 0) {
    return (
      <Card className="border-green-200">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("assistantTitle")}</CardTitle>
          <CardDescription className="text-xs">{t("assistantEmpty")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t("assistantTitle")}</CardTitle>
        <CardDescription className="text-xs">{t("assistant")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <div key={i} className={`flex items-start gap-2 rounded-md border p-3 text-sm ${it.tone}`}>
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">{it.title}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
