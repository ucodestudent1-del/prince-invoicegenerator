"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { UserActivityEntry } from "@/lib/actions/memberships";
import { getUserActivity } from "@/lib/actions/memberships";

const CATEGORY_COLORS: Record<string, string> = {
	AUTH: "bg-blue-100 text-blue-800",
	ADMIN: "bg-purple-100 text-purple-800",
	SETTINGS: "bg-gray-100 text-gray-800",
	DATA: "bg-orange-100 text-orange-800",
	BILLING: "bg-green-100 text-green-800",
	SECURITY: "bg-red-100 text-red-800",
};

export function MemberActivityDialog({
	memberId,
	memberName,
	orgId,
}: {
	memberId: string;
	memberName: string | null;
	orgId: string;
}) {
	const t = useTranslations("team");
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [entries, setEntries] = useState<UserActivityEntry[]>([]);

	async function loadActivity() {
		setOpen(true);
		setLoading(true);
		try {
			const data = await getUserActivity(memberId, orgId);
			setEntries(data);
		} catch (err: any) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	}

	return (
		<>
			<button
				onClick={loadActivity}
				className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
			>
				<Activity className="h-4 w-4" />
				{t("viewActivity")}
			</button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-3xl max-h-[80vh]">
					<DialogHeader>
						<DialogTitle>
							{t("activityLog")}: {memberName ?? memberId}
						</DialogTitle>
						<DialogDescription>
							{t("activityLogDescription")}
						</DialogDescription>
					</DialogHeader>
					{loading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin" />
						</div>
					) : entries.length === 0 ? (
						<p className="text-sm text-muted-foreground">{t("noActivity")}</p>
					) : (
						<div className="overflow-y-auto">
							<table className="w-full text-sm">
								<thead>
									<tr>
										<th className="text-left py-2 pr-4">{t("date")}</th>
										<th className="text-left py-2 pr-4">{t("category")}</th>
										<th className="text-left py-2 pr-4">{t("action")}</th>
										<th className="text-left py-2 pr-4">{t("target")}</th>
										<th className="text-left py-2 pr-4">{t("outcome")}</th>
									</tr>
								</thead>
								<tbody>
									{entries.map((entry) => (
										<tr key={entry.id} className="border-t">
											<td className="py-2 pr-4">
												{new Date(entry.createdAt).toLocaleString()}
											</td>
											<td className="py-2 pr-4">
												<Badge className={CATEGORY_COLORS[entry.category] ?? "bg-gray-100 text-gray-800"}>
													{entry.category}
												</Badge>
											</td>
											<td className="py-2 pr-4">{entry.action}</td>
											<td className="py-2 pr-4">
												{entry.targetType}
												{entry.targetId && ` #${entry.targetId.slice(0, 8)}`}
											</td>
											<td className="py-2 pr-4">
												<Badge variant={entry.outcome === "SUCCESS" ? "default" : "destructive"}>
													{entry.outcome}
												</Badge>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
