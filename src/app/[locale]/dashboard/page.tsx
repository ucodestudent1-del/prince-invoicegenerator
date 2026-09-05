import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/org";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, resolveFormatterLocale } from "@/lib/utils";
import {
	FileText,
	Plus,
	Receipt,
	Download,
	Wallet,
	CreditCard,
	BarChart3,
	ExternalLink,
	Repeat,
	TrendingDown,
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

type DashboardData = DashboardDerived & { recentInvoices: DashboardInvoiceInput[]; locale: string };

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

/** Humanise a raw Prisma status enum (e.g. "PARTIALLY_PAID" -> "Partially paid"). */
function humanizeStatus(status: string | null | undefined): string {
	if (!status) return "—";
	return status["toLowerCase"]()["replace"](/_+/g, " ")["replace"](/\b\w/g, (c) => c["toUpperCase"]());
}

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
	// Org-level formatter locale for money + date display.
	const formatLocale = resolveFormatterLocale(data.locale);

	const hasRevenueData = monthlyRevenue.some((m) => m["revenue"] > 0 || m["collected"] > 0);
	const maxRevenue = Math["max"](1, ...monthlyRevenue.map((m) => m["revenue"]));

	const isLoss = stats["estimatedProfit"] < 0;

	const statsCards: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }[] = [
		{ label: t("moneyOwed"), value: formatCurrency(stats["moneyOwed"], stats["currency"], formatLocale), icon: Wallet },
		{ label: t("overdue"), value: formatCurrency(stats["overdueAmount"], stats["currency"], formatLocale), icon: CreditCard },
		{ label: t("revenueThisMonth"), value: formatCurrency(stats["revenueThisMonth"], stats["currency"], formatLocale), icon: Receipt },
		{ label: t("collectedThisMonth"), value: formatCurrency(stats["collectedThisMonth"], stats["currency"], formatLocale), icon: CreditCard },
		{
			label: t("estimatedProfit"),
			value: formatCurrency(stats["estimatedProfit"], stats["currency"], formatLocale),
			icon: isLoss ? TrendingDown : BarChart3,
		},
	];

	const userName = (user["name"] ?? "")["trim"]();

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold">{t("overview")}</h1>
					<p className="text-sm text-muted-foreground">
						{userName ? t("welcomeBack", { name: userName }) : t("welcomeBackDefault")}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button variant="outline" size="sm" asChild>
						<Link href="/api/export/invoices?format=csv">
							<Download className="h-4 w-4 mr-2" aria-hidden="true" /> {t("exportCsv")}
						</Link>
					</Button>
					<Button asChild>
						<Link href="/dashboard/invoices/new">
							<Plus className="h-4 w-4 mr-2" aria-hidden="true" /> {t("newInvoice")}
						</Link>
					</Button>
				</div>
			</div>

			<div
				className={`grid gap-4 sm:grid-cols-2 ${isLoss ? "lg:grid-cols-5" : "lg:grid-cols-5"}`}
			>
				{statsCards.map((s) => {
					const Icon = s["icon"];
					const isProfitCard = s["label"] === t("estimatedProfit");
					return (
						<Card key={s["label"]} className={isProfitCard && isLoss ? "border-destructive/40" : undefined}>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">{s["label"]}</CardTitle>
								<Icon
									className={`h-4 w-4 ${isProfitCard && isLoss ? "text-destructive" : "text-muted-foreground"}`}
									aria-hidden="true"
								/>
							</CardHeader>
							<CardContent>
								<div
									className={`text-2xl font-bold ${isProfitCard && isLoss ? "text-destructive" : ""}`}
								>
									{s["value"]}
								</div>
								{isProfitCard && isLoss && (
									<p className="mt-1 text-xs text-destructive">{t("profitLoss")}</p>
								)}
							</CardContent>
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
								? t("attentionCount", { count: attentionItems.length })
								: t("allCaughtUp")}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{attentionItems.length === 0 ? null : (
							<ul className="space-y-3">
								{attentionItems.map((item) => (
									<li
										key={item["id"]}
										className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
									>
										<div className="space-y-0.5">
											<span className="font-medium">{item["title"]}</span>
											<span className="block text-sm text-muted-foreground">
												{formatCurrency(item["amount"], item["currency"], formatLocale)}
											</span>
										</div>
										<Button
											asChild
											size="sm"
											variant={priorityVariant[item["priority"]] ?? "default"}
											aria-label={`${item["actionLabel"]}: ${item["title"]}`}
										>
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
						<CardDescription>{t("monthlyRevenueDescription")}</CardDescription>
					</CardHeader>
					<CardContent>
						{!hasRevenueData ? (
							<div
								className="flex flex-col items-center justify-center gap-2 py-10 text-center"
								role="img"
								aria-label={t("chartAriaLabelEmpty")}
							>
								<BarChart3 className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
								<p className="text-sm text-muted-foreground">{t("chartEmpty")}</p>
							</div>
						) : (
							<RevenueChart
								points={monthlyRevenue}
								maxValue={maxRevenue}
								currency={stats["currency"]}
								locale={formatLocale}
								revenueLabel={t("revenue")}
								collectedLabel={t("collected")}
								ariaLabel={t("chartAriaLabel")}
							/>
						)}
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-lg">{t("recentActivity")}</CardTitle>
					<CardDescription>{t("recentActivityDescription")}</CardDescription>
				</CardHeader>
				<CardContent>
					{recentActivity.length === 0 ? (
						<p className="text-sm text-muted-foreground">{t("noActivity")}</p>
					) : (
						<ul className="space-y-3">
							{recentActivity.map((ev) => {
								// For paid invoices the outstanding is zero; showing
								// "$0.00" is noise. Surface only when there's an
								// outstanding balance.
								const showAmount = ev["amount"] != null && !(ev["paid"] === true && ev["amount"] <= 0);
								return (
									<li key={ev["id"]} className="flex items-center gap-3">
										<ActivityIcon type={ev["type"]} />
										<div className="flex-1 min-w-0">
											<span className="block font-medium truncate">{ev["title"]}</span>
											{ev["subtitle"] && (
												<span className="block text-sm text-muted-foreground truncate">
													{ev["subtitle"]}
												</span>
											)}
										</div>
										{showAmount && (
											<span className="text-sm font-medium whitespace-nowrap">
												{formatCurrency(ev["amount"] as number, stats["currency"], formatLocale)}
											</span>
										)}
										<span className="text-xs text-muted-foreground whitespace-nowrap">
											{formatDate(ev["date"], formatLocale)}
										</span>
									</li>
								);
							})}
						</ul>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-2">
						<CardTitle className="text-lg">{t("recentInvoices")}</CardTitle>
						<Button variant="outline" size="sm" asChild>
							<Link href="/dashboard/invoices">
								{t("viewAll")} <ExternalLink className="h-3 w-3 ml-1" aria-hidden="true" />
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
										const isPaid = inv["status"] === "PAID";
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
												<td className="text-right">
													{isPaid ? t("paid") : formatCurrency(outstanding, inv["currency"] ?? stats["currency"], formatLocale)}
												</td>
												<td>{inv["dueDate"] ? formatDate(inv["dueDate"], formatLocale) : "—"}</td>
												<td>
													<Badge variant={statusVariant[inv["status"] ?? ""] ?? "secondary"}>
														{humanizeStatus(inv["status"])}
													</Badge>
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
		locale: "en-US",
	};
}

function ActivityIcon({ type }: { type: string }) {
	switch (type) {
		case "payment":
			return <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
		case "expense":
			return <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
		case "change_order":
			return <Repeat className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
		case "invoice":
			return <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
		default:
			return <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
	}
}

function RevenueChart({
	points,
	maxValue,
	currency,
	locale,
	revenueLabel,
	collectedLabel,
	ariaLabel,
}: {
	points: MonthlyPoint[];
	maxValue: number;
	currency: string;
	locale: string;
	revenueLabel: string;
	collectedLabel: string;
	ariaLabel: string;
}) {
	const width = (value: number) => `${Math["round"]((value / (maxValue || 1)) * 100)}%`;
	return (
		<div className="space-y-3" role="img" aria-label={ariaLabel}>
			<div className="flex items-center justify-end gap-6 text-xs text-muted-foreground">
				<span className="flex items-center gap-1">
					<span className="h-2 w-2 rounded bg-primary" aria-hidden="true" /> {revenueLabel}
				</span>
				<span className="flex items-center gap-1">
					<span className="h-2 w-2 rounded bg-teal-500" aria-hidden="true" /> {collectedLabel}
				</span>
			</div>
			<div className="min-w-[480px] space-y-2">
				{points.map((m) => (
					<div key={m["label"]} className="flex items-center gap-3">
						<span className="w-14 shrink-0 text-xs text-muted-foreground">{m["label"]}</span>
						<div className="flex flex-1 items-center gap-2">
							<div className="flex-1 h-3 bg-muted rounded">
								<div className="h-3 bg-primary rounded" style={{ width: width(m["revenue"]) }} />
							</div>
							<span className="w-20 text-right text-xs tabular-nums">
								{formatCurrency(m["revenue"], currency, locale)}
							</span>
							<div className="flex-1 h-3 bg-muted rounded">
								<div className="h-3 bg-teal-500 rounded" style={{ width: width(m["collected"]) }} />
							</div>
							<span className="w-20 text-right text-xs tabular-nums">
								{formatCurrency(m["collected"], currency, locale)}
							</span>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
