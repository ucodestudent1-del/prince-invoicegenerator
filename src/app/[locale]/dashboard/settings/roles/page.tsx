import { requireUser } from "@/lib/org";
import { listRoles, deleteRole, type RoleRow } from "@/lib/actions/roles";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";
import { authorize } from "@/lib/authorization";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit } from "lucide-react";
import { CreateRoleDialog } from "@/components/team/create-role-dialog";
import { Suspense } from "react";

const PERMISSION_GROUPS: Record<string, Permission[]> = {
	Invoices: ALL_PERMISSIONS.filter((p) => p.startsWith("invoices.")),
	Payments: ALL_PERMISSIONS.filter((p) => p.startsWith("payments.")),
	Expenses: ALL_PERMISSIONS.filter((p) => p.startsWith("expenses.")),
	Projects: ALL_PERMISSIONS.filter((p) => p.startsWith("projects.")),
	Customers: ALL_PERMISSIONS.filter((p) => p.startsWith("customers.")),
	Estimates: ALL_PERMISSIONS.filter((p) => p.startsWith("estimates.")),
	ChangeOrders: ALL_PERMISSIONS.filter((p) => p.startsWith("changeOrders.")),
	TimeEntries: ALL_PERMISSIONS.filter((p) => p.startsWith("timeEntries.")),
	Catalog: ALL_PERMISSIONS.filter((p) => p.startsWith("catalog.")),
	Reports: ALL_PERMISSIONS.filter((p) => p.startsWith("reports.")),
	Team: ALL_PERMISSIONS.filter((p) => p.startsWith("team.")),
	Settings: ALL_PERMISSIONS.filter((p) => p.startsWith("settings.")),
	Templates: ALL_PERMISSIONS.filter((p) => p.startsWith("templates.")),
};

export default async function RolesPage({ params }: { params: { locale: string } }) {
	const user = await requireUser();
	if (!user || !user["organizationId"]) return null;
	const orgId = user["organizationId"];
	const t = await getTranslations("team");

	let roles: RoleRow[] = [];
	let canManage = false;
	try {
		roles = await listRoles(orgId);
		const decision = await authorize({
			userId: user["id"],
			orgId,
			permission: "settings.edit",
		});
		canManage = decision["allowed"];
	} catch (err) {
		logServerError("RolesPage", err);
	}

	return (
		<div className="space-y-6 max-w-5xl">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">{t("roles")}</h1>
					<p className="text-sm text-muted-foreground">{t("rolesDescription")}</p>
				</div>
				{canManage && <CreateRoleDialog orgId={orgId} />}
			</div>

			<div className="space-y-4">
				{roles.map((role) => (
					<RoleCard key={role.id} role={role} canManage={canManage} t={t} />
				))}
			</div>
		</div>
	);
}

function RoleCard({ role, canManage, t }: { role: RoleRow; canManage: boolean; t: any }) {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>{role.name}</CardTitle>
						{role.description && <CardDescription>{role.description}</CardDescription>}
					</div>
					<div className="flex items-center gap-2">
						{role.isSystem && <Badge variant="outline">{t("systemRole")}</Badge>}
						{!role.isSystem && canManage && (
							<>
								<Button variant="ghost" size="sm">
									<Edit className="h-4 w-4" />
								</Button>
								<form
									action={async () => {
										"use server";
										await deleteRole(role.id);
									}}
								>
									<Button variant="ghost" size="sm" type="submit">
										<Trash2 className="h-4 w-4 text-destructive" />
									</Button>
								</form>
							</>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<p className="text-xs text-muted-foreground mb-2">
					{role.permissions.length} {t("permissions")}
				</p>
				<div className="flex flex-wrap gap-1">
					{role.permissions.slice(0, 10).map((p) => (
						<Badge key={p} variant="secondary" className="text-xs">
							{p}
						</Badge>
					))}
					{role.permissions.length > 10 && (
						<Badge variant="secondary" className="text-xs">
							+{role.permissions.length - 10} more
						</Badge>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
