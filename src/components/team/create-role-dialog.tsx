"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Save, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createRole } from "@/lib/actions/roles";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

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

export function CreateRoleDialog({ orgId }: { orgId: string }) {
	const t = useTranslations("team");
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function togglePerm(perm: string) {
		setSelectedPerms((prev) => {
			const next = new Set(prev);
			if (next.has(perm)) next.delete(perm);
			else next.add(perm);
			return next;
		});
	}

	function handleSubmit() {
		setError(null);
		startTransition(async () => {
			try {
				await createRole({
					orgId,
					name: name.trim(),
					description: description.trim() || null,
					permissions: Array.from(selectedPerms),
				});
				setOpen(false);
				setName("");
				setDescription("");
				setSelectedPerms(new Set());
				revalidatePath("/dashboard/settings/roles");
			} catch (err: any) {
				setError(err.message ?? "Failed to create role.");
			}
		});
	}

	function handleOpenChange(open: boolean) {
		if (!open) {
			setName("");
			setDescription("");
			setSelectedPerms(new Set());
			setError(null);
		}
		setOpen(open);
	}

	return (
		<>
			<Button onClick={() => setOpen(true)}>
				<Plus className="h-4 w-4 mr-2" />
				{t("createRole")}
			</Button>
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{t("createRole")}</DialogTitle>
						<DialogDescription>{t("createRoleDescription")}</DialogDescription>
					</DialogHeader>
					{error && (
						<div className="text-sm text-red-600">{error}</div>
					)}
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="role-name">{t("roleName")}</Label>
							<Input
								id="role-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder={t("roleNamePlaceholder")}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="role-description">{t("roleDescription")}</Label>
							<Textarea
								id="role-description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder={t("roleDescriptionPlaceholder")}
							/>
						</div>
						<div className="space-y-3">
							<Label>{t("permissionMatrix")}</Label>
							{Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
								<div key={group} className="space-y-1">
									<p className="text-xs font-medium">{group}</p>
									<div className="flex flex-wrap gap-2">
										{perms.map((perm) => (
											<label key={perm} className="flex items-center gap-1 text-xs">
												<Checkbox
													checked={selectedPerms.has(perm)}
													onCheckedChange={() => togglePerm(perm)}
												/>
												<span>{perm}</span>
											</label>
										))}
									</div>
								</div>
							))}
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setOpen(false)}>
							<X className="h-4 w-4 mr-1" />
							{t("cancel")}
						</Button>
						<Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
							<Save className="h-4 w-4 mr-1" />
							{isPending ? t("saving") : t("create")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
