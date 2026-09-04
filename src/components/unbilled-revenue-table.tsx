"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createInvoiceFromUnbilledItem } from "@/lib/actions/unbilled-revenue";
import type { UnbilledRevenueItem, UnbilledRevenueSummary } from "@/lib/unbilled-revenue";
import {
	Receipt,
	X,
	Eye,
	CheckCircle,
	AlertCircle,
	ExternalLink,
} from "lucide-react";

const TYPE_LABEL: Record<UnbilledRevenueItem["type"], string> = {
	completed_milestone: "Milestone",
	approved_change_order: "Change Order",
	billable_expense: "Expense",
	unbilled_time: "Time",
};

const TYPE_COLOR: Record<UnbilledRevenueItem["type"], string> = {
	completed_milestone: "bg-blue-100 text-blue-800",
	approved_change_order: "bg-amber-100 text-amber-800",
	billable_expense: "bg-emerald-100 text-emerald-800",
	unbilled_time: "bg-purple-100 text-purple-800",
};

interface Props {
	items: UnbilledRevenueItem[];
	total: number;
	currency: string;
	byType: UnbilledRevenueSummary["byType"];
}

export function UnbilledRevenueTable({ items, total, currency, byType }: Props) {
	const router = useRouter();
	const [selected, setSelected] = useState<UnbilledRevenueItem | null>(null);
	const [creatingId, setCreatingId] = useState<string | null>(null);

	async function handleCreate(item: UnbilledRevenueItem) {
		setCreatingId(item.id);
		try {
			const invoice = await createInvoiceFromUnbilledItem(item);
			if (invoice?.id) {
				router.push(`/dashboard/invoices/${invoice.id}`);
			}
		} catch (err: any) {
			console.error(err?.message ?? err);
		} finally {
			setCreatingId(null);
		}
	}

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle className="text-sm font-medium text-muted-foreground">
						Breakdown by source
					</CardTitle>
				</CardHeader>
				<CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{(Object.keys(byType) as (keyof typeof byType)[]).map((k) => (
						<div key={k}>
							<p className="text-xs text-muted-foreground">{TYPE_LABEL[k as UnbilledRevenueItem["type"]]}</p>
							<p className="text-lg font-semibold">{formatCurrency(byType[k], currency)}</p>
						</div>
					))}
				</CardContent>
			</Card>

			<div className="overflow-x-auto rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Project</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Reason</TableHead>
							<TableHead className="text-right">Amount</TableHead>
							<TableHead>Recommended action</TableHead>
							<TableHead className="text-center">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{items.map((item) => {
							const isCreating = creatingId === item.id;
							return (
								<TableRow key={item.id}>
									<TableCell>
										<div className="font-medium">{item.projectName}</div>
										{item.customerName && (
											<div className="text-xs text-muted-foreground">{item.customerName}</div>
										)}
									</TableCell>
									<TableCell>
										<Badge variant="outline" className={TYPE_COLOR[item.type]}>
											{TYPE_LABEL[item.type]}
										</Badge>
									</TableCell>
									<TableCell className="max-w-xs">
										<div className="line-clamp-2 text-sm">{item.reason}</div>
									</TableCell>
									<TableCell className="font-medium text-right">
										{formatCurrency(item.amount, item.currency)}
									</TableCell>
									<TableCell className="text-sm text-muted-foreground">
										{item.recommendedAction}
									</TableCell>
									<TableCell>
										<div className="flex items-center justify-center gap-1">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setSelected(item)}
												title="Review"
											>
												<Eye className="h-4 w-4" />
											</Button>
											<Button
												size="sm"
												onClick={() => handleCreate(item)}
												disabled={isCreating}
												title="Create invoice"
											>
												{isCreating ? "Creating…" : "Create Invoice"}
											</Button>
										</div>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>

			{selected && (
				<ReviewPanel item={selected} onClose={() => setSelected(null)} onCreate={() => handleCreate(selected)} />
			)}
		</>
	);
}

function ReviewPanel({
	item,
	onClose,
	onCreate,
}: {
	item: UnbilledRevenueItem;
	onClose: () => void;
	onCreate: () => void;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-end justify-end">
			<div
				className="absolute inset-0 bg-black/20"
				onClick={onClose}
				aria-hidden="true"
			/>
			<div className="relative z-10 h-full w-full max-w-lg overflow-y-auto border-l bg-background shadow-xl">
				<div className="p-6">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-semibold">Review unbilled item</h2>
						<Button variant="ghost" size="sm" onClick={onClose}>
							<X className="h-4 w-4" />
						</Button>
					</div>

					<div className="mt-4 space-y-4">
						<div className="flex items-center gap-2">
							<Badge variant="outline" className={TYPE_COLOR[item.type]}>
								{TYPE_LABEL[item.type]}
							</Badge>
							<span className="text-xs text-muted-foreground">
								{formatDate(new Date())}
							</span>
						</div>

						<div>
							<label className="text-xs font-medium text-muted-foreground">Project</label>
							<p className="font-medium">{item.projectName}</p>
							{item.customerName && (
								<p className="text-sm text-muted-foreground">{item.customerName}</p>
							)}
						</div>

						<div>
							<label className="text-xs font-medium text-muted-foreground">Reason</label>
							<p className="text-sm">{item.reason}</p>
						</div>

						<div className="flex items-baseline justify-between">
							<label className="text-xs font-medium text-muted-foreground">Amount</label>
							<span className="text-2xl font-bold">
								{formatCurrency(item.amount, item.currency)}
							</span>
						</div>

						<div>
							<label className="text-xs font-medium text-muted-foreground">Recommended action</label>
							<p className="text-sm">{item.recommendedAction}</p>
						</div>

						{item.detail && (
							<div>
								<label className="text-xs font-medium text-muted-foreground">Detail</label>
								<p className="text-sm">{item.detail}</p>
							</div>
						)}
					</div>

					<div className="mt-6 flex gap-3">
						{item.projectId && (
							<Button asChild variant="outline" size="sm">
								<a href={`/dashboard/projects/${item.projectId}`}>
									<ExternalLink className="mr-2 h-4 w-4" />
									Open project
								</a>
							</Button>
						)}
						<Button onClick={onCreate} size="sm" className="ml-auto">
							Create Invoice
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

export { ReviewPanel };
