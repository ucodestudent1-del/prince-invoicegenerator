import { requireUser, requireFeature } from "@/lib/org";
import { listMemberships, listProjectsForOrg } from "@/lib/actions/memberships";
import type { MembershipRow, ProjectRow } from "@/lib/actions/memberships";
import { authorize } from "@/lib/authorization";
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
import { MemberActionMenu } from "@/components/team/member-action-menu";
import { SYSTEM_ROLES } from "@/lib/permissions";

export default async function TeamPage({ params }: { params: { locale: string } }) {
	await requireFeature("multipleUsers");
	const user = await requireUser();
	if (!user || !user["organizationId"]) return null;
	const orgId = user["organizationId"];
	const t = await getTranslations("team");

	let members: MembershipRow[] = [];
	let projects: ProjectRow[] = [];
	let canManage = false;

	try {
		members = await listMemberships(orgId);
		projects = await listProjectsForOrg(orgId);

		const decision = await authorize({
			userId: user["id"],
			orgId,
			permission: "team.invite",
		});
		canManage = decision["allowed"];
	} catch (err) {
		logServerError("TeamPage", err);
		members = [];
		projects = [];
	}

	function getRoleLabel(roleId: string | null): string {
		if (!roleId) return "—";
		const role = SYSTEM_ROLES.find((r) => r.id === roleId);
		return role?.name ?? roleId;
	}

	function statusBadge(status: string) {
		const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
			active: "default",
			invited: "secondary",
			inactive: "outline",
			deactivated: "destructive",
		};
		return <Badge variant={variants[status] ?? "secondary"}>{status}</Badge>;
	}

	function invitationBadge(status: string) {
		const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
			accepted: "default",
			pending: "secondary",
			expired: "destructive",
			not_invited: "outline",
		};
		return <Badge variant={variants[status] ?? "secondary"}>{status}</Badge>;
	}

	function formatLastActivity(date: Date | null): string {
		if (!date) return "—";
		return new Date(date).toLocaleString();
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold">{t("title")}</h1>
				<p className="text-sm text-muted-foreground">{t("description")}</p>
			</div>

			{canManage && (
				<Card>
					<CardHeader>
						<CardTitle>{t("invite")}</CardTitle>
					</CardHeader>
					<CardContent>
						<InviteTeamMemberForm />
					</CardContent>
				</Card>
			)}

			<Card>
				<CardContent className="pt-6">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("member")}</TableHead>
								<TableHead>{t("email")}</TableHead>
								<TableHead>{t("jobTitle")}</TableHead>
								<TableHead>{t("systemRole")}</TableHead>
								<TableHead>{t("assignedProjects")}</TableHead>
								<TableHead>{t("accountStatus")}</TableHead>
								<TableHead>{t("invitationStatus")}</TableHead>
								<TableHead>{t("lastActivity")}</TableHead>
								<TableHead>{t("permissions")}</TableHead>
								{canManage && <TableHead className="text-right">{t("actions")}</TableHead>}
							</TableRow>
						</TableHeader>
						<TableBody>
							{members.map((m) => (
								<TableRow key={m["id"]}>
									<TableCell>
										<div className="flex items-center gap-2">
											<Avatar className="h-7 w-7">
												<AvatarFallback className="text-xs">
													{(m["name"] ?? "U").slice(0, 2).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<span className="font-medium">{m["name"] ?? "—"}</span>
										</div>
									</TableCell>
									<TableCell>{m["email"] ?? "—"}</TableCell>
									<TableCell>{m["jobTitle"] ?? "—"}</TableCell>
									<TableCell>
										<Badge variant={m["userId"] === user["id"] ? "default" : "secondary"}>
											{getRoleLabel(m["roleId"])}
										</Badge>
									</TableCell>
									<TableCell>
										{m["assignedProjects"].length === 0
											? "—"
											: m["assignedProjects"].slice(0, 2).map((p) => p["name"]).join(", ") +
											  (m["assignedProjects"].length > 2 ? ` +${m["assignedProjects"].length - 2}` : "")}
									</TableCell>
									<TableCell>{statusBadge(m["accountStatus"])}</TableCell>
									<TableCell>{invitationBadge(m["invitationStatus"])}</TableCell>
									<TableCell className="text-xs">{formatLastActivity(m["lastActivity"])}</TableCell>
									<TableCell>
										<PermissionBadgeList permissions={m["permissions"]} />
									</TableCell>
									{canManage && (
										<TableCell className="text-right">
											<MemberActionMenu
												member={m}
												orgId={orgId}
												projects={projects}
												canManage={canManage}
											/>
										</TableCell>
									)}
								</TableRow>
							))}
							{members.length === 0 && (
								<TableRow>
									<TableCell colSpan={canManage ? 10 : 9} className="text-center py-8 text-muted-foreground">
										{t("noMembers")}
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
