import { requireUser, requireFeature } from "@/lib/org";
import { listMemberships } from "@/lib/actions/memberships";
import type { MembershipRow } from "@/lib/actions/memberships";
import { getRole } from "@/lib/actions/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";
import { InviteTeamMemberForm } from "@/components/team/invite-team-member-form";
import { PermissionBadgeList } from "@/components/permission-badge-list";

export default async function TeamPage({ params }: { params: { locale: string } }) {
	await requireFeature("multipleUsers");
	const user = await requireUser();
	if (!user || !user["organizationId"]) return null;
	const orgId = user["organizationId"];
	const t = await getTranslations("team");

	let members: MembershipRow[];
	try {
		members = await listMemberships(orgId);
	} catch (err) {
		logServerError("TeamPage listMemberships", err);
		members = [];
	}

	// Resolve the caller's own role so we know whether they can manage members.
	let callerRoleId: string | null = null;
	for (const m of members) {
		if (m["userId"] === user["id"]) {
			callerRoleId = m["roleId"];
			break;
		}
	}
	const callerRole = callerRoleId ? await getRole(callerRoleId, orgId).catch(() => null) : null;
	const canManage = callerRole?.["permissions"]?.["some"]((p) => p === "team.invite" || p === "team.remove") ?? false;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold">{t("title")}</h1>
				<p className="text-sm text-muted-foreground">{t("description")}</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t("invite")}</CardTitle>
				</CardHeader>
				<CardContent>
					<InviteTeamMemberForm />
				</CardContent>
			</Card>

			<Card>
				<CardContent className="pt-6">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("member")}</TableHead>
								<TableHead>{t("email")}</TableHead>
								<TableHead>{t("role")}</TableHead>
								<TableHead>{t("permissions")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{members.map((m) => (
								<TableRow key={m["id"]}>
									<TableCell className="flex items-center gap-2">
										<Avatar className="h-7 w-7">
											<AvatarFallback className="text-xs">
												{(m["name"] ?? "U").slice(0, 2).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<span className="font-medium">{m["name"] ?? "—"}</span>
									</TableCell>
									<TableCell>{m["email"] ?? "—"}</TableCell>
									<TableCell>
										<Badge variant={m["userId"] === user["id"] ? "default" : "secondary"}>
											{m["roleName"] ?? "—"}
										</Badge>
									</TableCell>
									<TableCell>
										<PermissionBadgeList permissions={m["permissions"]} />
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
