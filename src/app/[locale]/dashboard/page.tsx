import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/org";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
	FileText,
	Plus,
	Receipt,
	Download,
	Wallet,
	CreditCard,
	BarChart3,
	ExternalLink,
} from "lucide-react";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";
import { getOnboardingState } from "@/lib/actions/onboarding";
import { redirect } from "@/i18n/navigation";
import { getLocaleSafe } from "@/lib/locale";
import { getDashboardData } from "@/lib/actions/dashboard";
import type {
	DashboardDerived,
	DashboardInvoiceInput,
	AttentionItem,
	MonthlyPoint,
} from "@/lib/dashboard";

type DashboardData = DashboardDerived & { recentInvoices: DashboardInvoiceInput[] };

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

const priorityVariant: Record<AttentionItem["priority"], "default" | "secondary" | "destructive" | "outline"> = {
	high: "destructive",
	medium: "default",
	low: "secondary",
};

export default async function DashboardPage({ params }: { params: { locale: string } }) {
	const user = await requireUser();
	const locale = await getLocaleSafe();

	const onboarding = await getOnboardingState();
	if (onboarding["shouldOnboard"]) {
		redirect({ href: "/onboarding", locale });
	}

	if (!user || !user["organizationId"]) return null;
	const t = await getTranslations("dashboard");

	let data: DashboardData;
	try {
		data = await getDashboardData();
	} catch (err) {
		logServerError("DashboardPage", err);
		data = emptyDashboard();
	}

	const { stats, attentionItems, monthlyRevenue, recentActivity, recentInvoices } = data;

	const maxRevenue = Math["max"](1, ...monthlyRevenue.map((m) => m["revenue"]));

	const statsCards: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }[] = [
		{ label: t("moneyOwed"), value: formatCurrency(stats["moneyOwed"], stats["currency"]), icon: Wallet },
		{ label: t("overdue"), value: formatCurrency(stats["overdueAmount"], stats["currency"]), icon: CreditCard },
		{ label: t("revenueThisMonth"), value: formatCurrency(stats["revenueThisMonth"], stats["currency"]), icon: Receipt },
		{ label: t("collectedThisMonth"), value: formatCurrency(stats["collectedThisMonth"], stats["currency"]), icon: CreditCard },
		{ label: t("estimatedProfit"), value: formatCurrency(stats["estimatedProfit"], stats["currency"]), icon: BarChart3 },
	];

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">{t("overview")}</h1>
					<p className="text-sm text-muted-foreground">
						{t("welcomeBack", { name: user["name"] ?? "" })}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" asChild>
						<Link href="/api/export/invoices?format=csv">
							<Download className="h-4 w-4 mr-2" /> Export CSV
						</Link>
					</Button>
					<Button asChild>
						<Link href="/dashboard/invoices/new">
							<Plus className="h-4 w-4 mr-2" /> {t("newInvoice")}
						</Link>
					</Button>
				</div>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
				{statsCards.map((s) => {
					const Icon = s["icon"];
					return (
						<Card key={s["label"]}>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">{s["label"]}</CardTitle>
								<Icon className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent className="text-2xl font-bold">{s["value"]}</CardContent>
						</Card>
					);
				})}
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">{t("needsAttention")}</CardTitle>
						<CardDescription>
							{attentionItems.length > 0
								? `${attentionItems.length} item${attentionItems.length === 1 ? "" : "s"} need${attentionItems.length === 1 ? "" : "s"} your attention`
								: "Nothing needs your attention right now."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{attentionItems.length === 0 ? (
							<p className="text-sm text-muted-foreground">All caught up.</p>
						) : (
							<ul className="space-y-3">
								{attentionItems.map((item) => (
									<li key={item["id"]} className="flex items-center justify-between">
										<div className="space-y-0.5">
											<span className="font-medium">{item["title"]}</span>
											<span className="text-sm text-muted-foreground">
												{formatCurrency(item["amount"], item["currency"])}
											</span>
										</div>
										<Button asChild size="sm" variant={priorityVariant[item["priority"]] ?? "default"}>
											<Link href={item["actionHref"]}>{item["actionLabel"]}</Link>
										</Button>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-lg">{t("monthlyRevenue")}</CardTitle>
						<CardDescription>
							{t("revenue")} vs {t("collected")} over the last 12 months
						</CardDescription>
					</CardHeader>
					<CardContent>
						<RevenueChart points={monthlyRevenue} maxValue={maxRevenue} currency={stats["currency"]} revenueLabel={t("revenue")} collectedLabel={t("collected")} />
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-lg">{t("recentActivity")}</CardTitle>
					<CardDescription>Latest invoices, payments, expenses, and change orders.</CardDescription>
				</CardHeader>
				<CardContent>
					{recentActivity.length === 0 ? (
						<p className="text-sm text-muted-foreground">{t("noActivity")}</p>
					) : (
						<ul className="space-y-3">
							{recentActivity.map((ev) => (
								<li key={ev["id"]} className="flex items-center gap-3">
									<ActivityIcon type={ev["type"]} />
									<div className="flex-1">
										<span className="font-medium">{ev["title"]}</span>
										{ev["subtitle"] && <span className="text-sm text-muted-foreground"> — {ev["subtitle"]}</span>}
									</div>
									{ev["amount"] != null && (
										<span className="text-sm font-medium">{formatCurrency(ev["amount"], stats["currency"])}</span>
									)}
									<span className="text-xs text-muted-foreground">{formatDate(ev["date"])}</span>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="text-lg">{t("recentInvoices")}</CardTitle>
						<Button variant="outline" size="sm" asChild>
							<Link href="/dashboard/invoices">
								{t("viewAll")} <ExternalLink className="h-3 w-3 ml-1" />
							</Link>
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{recentInvoices.length === 0 ? (
						<p className="text-sm text-muted-foreground">{t("noInvoices")}</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b text-left text-muted-foreground">
										<th className="py-2">{t("number")}</th>
										<th className="py-2">{t("customer")}</th>
										<th className="py-2 text-right">{t("outstanding")}</th>
										<th className="py-2">{t("dueDate")}</th>
										<th className="py-2">{t("status")}</th>
									</tr>
								</thead>
								<tbody>
									{recentInvoices.map((inv) => {
										const outstanding = Math["max"](0, (inv["total"] ?? 0) - (inv["amountPaid"] ?? 0));
										return (
											<tr key={inv["id"]} className="border-b">
												<td className="py-2">
													<Link
														href={`/dashboard/invoices/${inv["id"]}`}
														className="font-medium text-primary hover:underline"
													>
														{inv["number"]}
													</Link>
												</td>
												<td>{inv["customerName"] ?? "—"}</td>
												<td className="text-right">{formatCurrency(outstanding, inv["currency"] ?? stats["currency"])}</td>
												<td>{inv["dueDate"] ? formatDate(inv["dueDate"]) : "—"}</td>
												<td>
													<Badge variant={statusVariant[inv["status"] ?? ""] ?? "secondary"}>{inv["status"]}</Badge>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function emptyDashboard(): DashboardData {
	return {
		stats: { moneyOwed: 0, overdueAmount: 0, revenueThisMonth: 0, collectedThisMonth: 0, estimatedProfit: 0, currency: "USD" },
		attentionItems: [],
		monthlyRevenue: [],
		recentActivity: [],
		recentInvoices: [],
	};
}

function ActivityIcon({ type }: { type: string }) {
	switch (type) {
		case "payment":
			return <Receipt className="h-4 w-4 text-muted-foreground" />;
		case "expense":
			return <CreditCard className="h-4 w-4 text-muted-foreground" />;
		case "change_order":
			return <FileText className="h-4 w-4 text-muted-foreground" />;
		default:
			return <FileText className="h-4 w-4 text-muted-foreground" />;
	}
}

function RevenueChart({ points, maxValue, currency, revenueLabel, collectedLabel }: { points: MonthlyPoint[]; maxValue: number; currency: string; revenueLabel: string; collectedLabel: string }) {
	const width = (value: number) => `${Math["round"]((value / (maxValue || 1)) * 100)}%`;
	return (
		<div className="space-y-3">
			<div className="flex items-center justify-end gap-6 text-xs text-muted-foreground">
				<span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-primary" /> {revenueLabel}</span>
				<span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-teal-500" /> {collectedLabel}</span>
			</div>
			{points.map((m) => (
				<div key={m["label"]} className="flex items-center gap-3">
					<span className="w-14 text-xs text-muted-foreground">{m["label"]}</span>
					<div className="flex flex-1 items-center gap-2">
						<div className="flex-1 h-3 bg-muted rounded">
							<div className="h-3 bg-primary rounded" style={{ width: width(m["revenue"]) }} />
						</div>
						<span className="w-16 text-right text-xs">{formatCurrency(m["revenue"], currency)}</span>
						<div className="flex-1 h-3 bg-muted rounded">
							<div className="h-3 bg-teal-500 rounded" style={{ width: width(m["collected"]) }} />
						</div>
						<span className="w-16 text-right text-xs">{formatCurrency(m["collected"], currency)}</span>
					</div>
				</div>
			))}
		</div>
	);
}
