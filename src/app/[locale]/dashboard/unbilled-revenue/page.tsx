import { requireUser } from "@/lib/org";
import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { UnbilledRevenueTable } from "@/components/unbilled-revenue-table";
import { getUnbilledRevenue } from "@/lib/actions/unbilled-revenue";
import {
	Receipt,
	ArrowLeft,
	Eye,
	FileText,
	BarChart3,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UnbilledRevenuePage({ params }: { params: { locale: string } }) {
	await requireUser();
	const t = await getTranslations("dashboard");
	const tCommon = await getTranslations("common");

	let summary;
	try {
		summary = await getUnbilledRevenue();
	} catch (err: any) {
		summary = { items: [], total: 0, currency: "USD", byType: { completed_milestone: 0, approved_change_order: 0, billable_expense: 0, unbilled_time: 0 } };
	}

	const typeLabel: Record<string, string> = {
		completed_milestone: "Milestone",
		approved_change_order: "Change Order",
		billable_expense: "Expense",
		unbilled_time: "Time",
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Button asChild variant="ghost" size="sm">
						<Link href="/dashboard">
							<ArrowLeft className="mr-2 h-4 w-4" /> {t("overview")}
						</Link>
					</Button>
					<div>
						<h1 className="text-2xl font-bold">Unbilled Revenue</h1>
						<p className="text-sm text-muted-foreground">
							Billable work that has not yet been invoiced.
						</p>
					</div>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-sm font-medium text-muted-foreground">
						Total Potential Unbilled Revenue
					</CardTitle>
					<CardDescription>
						{summary.items.length} items across {formatCurrency(summary.total, summary.currency)}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-4xl font-bold">{formatCurrency(summary.total, summary.currency)}</div>
					{summary.total > 0 && (
						<p className="mt-2 text-sm text-muted-foreground">
							Select items below and create invoices to capture this revenue.
						</p>
					)}
				</CardContent>
			</Card>

			{summary.items.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<Receipt className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
						<p className="text-sm text-muted-foreground">No unbilled revenue detected.</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Completed milestones, approved change orders, billable expenses, and unbilled
							billable time will appear here.
						</p>
					</CardContent>
				</Card>
			) : (
				<UnbilledRevenueTable items={summary.items} total={summary.total} currency={summary.currency} byType={summary.byType} />
			)}
		</div>
	);
}
