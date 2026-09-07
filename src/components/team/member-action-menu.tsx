"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MoreVertical, UserCheck, UserX, Send, FolderOpen, Edit, Activity, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { SYSTEM_ROLES } from "@/lib/permissions";
import type { SystemRoleId } from "@/lib/permissions";
import type { MembershipRow, ProjectRow, UserActivityEntry } from "@/lib/actions/memberships";
import {
	updateMemberRole,
	deactivateMember,
	reactivateMember,
	resendInvitation,
	assignProjects,
	updateMemberJobTitle,
	removeMember,
	getUserActivity,
} from "@/lib/actions/memberships";

interface MemberActionMenuProps {
	member: MembershipRow;
	orgId: string;
	projects: ProjectRow[];
	canManage: boolean;
}

export function MemberActionMenu({ member, orgId, projects, canManage }: MemberActionMenuProps) {
	const t = useTranslations("team");
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	const canResend = member.invitationStatus === "pending";
	const canBeDeactivated = member.accountStatus === "active" || member.accountStatus === "invited";
	const canBeReactivated = member.accountStatus === "deactivated";

	function runAction(fn: () => Promise<any>) {
		setError(null);
		startTransition(async () => {
			try {
				await fn();
			} catch (err: any) {
				setError(err.message ?? "Action failed.");
			}
		});
	}

	if (!canManage) return null;

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="sm" className="h-7 w-7 p-0">
						<MoreVertical className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-52">
					<DropdownMenuLabel>{t("actions")}</DropdownMenuLabel>

					<ChangeRoleDialog member={member} orgId={orgId} />
					<ChangeJobTitleDialog member={member} orgId={orgId} />
					<AssignProjectsDialog member={member} orgId={orgId} projects={projects} />

					{canResend && (
						<DropdownMenuItem
							onSelect={() => runAction(() => resendInvitation({ orgId, userId: member.userId }))}
							disabled={isPending}
						>
							<Send className="h-4 w-4 mr-2" />
							{t("resendInvitation")}
						</DropdownMenuItem>
					)}

					{canBeDeactivated && (
						<DropdownMenuItem
							onSelect={() => runAction(() => deactivateMember({ orgId, userId: member.userId }))}
							disabled={isPending}
						>
							<UserX className="h-4 w-4 mr-2" />
							{t("deactivate")}
						</DropdownMenuItem>
					)}

					{canBeReactivated && (
						<DropdownMenuItem
							onSelect={() => runAction(() => reactivateMember({ orgId, userId: member.userId }))}
							disabled={isPending}
						>
							<UserCheck className="h-4 w-4 mr-2" />
							{t("reactivate")}
						</DropdownMenuItem>
					)}

					<DropdownMenuSeparator />

					<DropdownMenuItem
						onSelect={() => runAction(() =>
							(async () => {
								const activity = await getUserActivity(member.userId, orgId);
								console.log("User activity:", activity);
							})()
						)}
						disabled={isPending}
					>
						<Activity className="h-4 w-4 mr-2" />
						{t("viewActivity")}
					</DropdownMenuItem>

					<DropdownMenuSeparator />

					<DropdownMenuItem
						onSelect={() => {
							if (
								window.confirm(
									`${t("removeConfirm")} ${member.name ?? member.email}?`
								)
							) {
								runAction(() => removeMember({ orgId, userId: member.userId }));
							}
						}}
						disabled={isPending}
						className="text-destructive focus:text-destructive"
					>
						<Trash2 className="h-4 w-4 mr-2" />
						{t("remove")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			{error && <div className="text-xs text-red-600 mt-1">{error}</div>}
		</>
	);
}

function ChangeRoleDialog({ member, orgId }: { member: MembershipRow; orgId: string }) {
	const t = useTranslations("team");
	const [open, setOpen] = useState(false);
	const [selectedRoleId, setSelectedRoleId] = useState<string>(member.roleId ?? "");
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleSave() {
		if (!selectedRoleId) return;
		setError(null);
		startTransition(async () => {
			try {
				await updateMemberRole({ orgId, userId: member.userId, roleId: selectedRoleId });
				setOpen(false);
			} catch (err: any) {
				setError(err.message ?? "Failed to update role.");
			}
		});
	}

	return (
		<>
			<DropdownMenuItem
				onSelect={(e) => {
					e.preventDefault();
					setOpen(true);
				}}
			>
				<UserCheck className="h-4 w-4 mr-2" />
				{t("changeRole")}
			</DropdownMenuItem>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{t("changeRole")}: {member.name ?? member.email}</DialogTitle>
						<DialogDescription>{t("changeRoleDescription")}</DialogDescription>
					</DialogHeader>
					{error && <div className="text-sm text-red-600">{error}</div>}
					<div className="space-y-3">
						{SYSTEM_ROLES.map((role) => (
							<label
								key={role.id}
								className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent ${
									selectedRoleId === role.id ? "border-primary bg-accent" : ""
								}`}
							>
								<Checkbox
									checked={selectedRoleId === role.id}
									onCheckedChange={() => setSelectedRoleId(role.id)}
									className="mt-0.5"
								/>
								<div>
									<p className="font-medium">{role.name}</p>
									<p className="text-xs text-muted-foreground">{role.description}</p>
								</div>
							</label>
						))}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setOpen(false)}>
							{t("cancel")}
						</Button>
						<Button onClick={handleSave} disabled={isPending || !selectedRoleId}>
							{isPending ? t("saving") : t("save")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			</>
	);
}

function ChangeJobTitleDialog({ member, orgId }: { member: MembershipRow; orgId: string }) {
	const t = useTranslations("team");
	const [open, setOpen] = useState(false);
	const [jobTitle, setJobTitle] = useState(member.jobTitle ?? "");
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleSave() {
		setError(null);
		startTransition(async () => {
			try {
				await updateMemberJobTitle({ orgId, userId: member.userId, jobTitle: jobTitle.trim() || null });
				setOpen(false);
			} catch (err: any) {
				setError(err.message ?? "Failed to update job title.");
			}
		});
	}

	return (
		<>
			<DropdownMenuItem
				onSelect={(e) => {
					e.preventDefault();
					setOpen(true);
				}}
			>
				<Edit className="h-4 w-4 mr-2" />
				{t("changeJobTitle")}
			</DropdownMenuItem>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>{t("changeJobTitle")}</DialogTitle>
						<DialogDescription>{t("changeJobTitleDescription")}</DialogDescription>
					</DialogHeader>
					{error && <div className="text-sm text-red-600">{error}</div>}
					<div className="space-y-2">
						<Label htmlFor="job-title-input">{t("jobTitle")}</Label>
						<Input
							id="job-title-input"
							value={jobTitle}
							onChange={(e) => setJobTitle(e.target.value)}
							placeholder={t("jobTitlePlaceholder")}
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setOpen(false)}>
							{t("cancel")}
						</Button>
						<Button onClick={handleSave} disabled={isPending}>
							{isPending ? t("saving") : t("save")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function AssignProjectsDialog({ member, orgId, projects }: { member: MembershipRow; orgId: string; projects: ProjectRow[] }) {
	const t = useTranslations("team");
	const [open, setOpen] = useState(false);
	const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(
		new Set(member.assignedProjects.map((p) => p.id))
	);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleSave() {
		setError(null);
		startTransition(async () => {
			try {
				await assignProjects({
					orgId,
					userId: member.userId,
					projectIds: Array.from(selectedProjectIds),
				});
				setOpen(false);
			} catch (err: any) {
				setError(err.message ?? "Failed to assign projects.");
			}
		});
	}

	function toggleProject(projectId: string) {
		setSelectedProjectIds((prev) => {
			const next = new Set(prev);
			if (next.has(projectId)) next.delete(projectId);
			else next.add(projectId);
			return next;
		});
	}

	return (
		<>
			<DropdownMenuItem
				onSelect={(e) => {
					e.preventDefault();
					setOpen(true);
				}}
			>
				<FolderOpen className="h-4 w-4 mr-2" />
				{t("assignProjects")}
			</DropdownMenuItem>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{t("assignProjects")}: {member.name ?? member.email}</DialogTitle>
						<DialogDescription>{t("assignProjectsDescription")}</DialogDescription>
					</DialogHeader>
					{error && <div className="text-sm text-red-600">{error}</div>}
					{projects.length === 0 ? (
						<p className="text-sm text-muted-foreground">{t("noProjects")}</p>
					) : (
						<div className="space-y-2 max-h-60 overflow-y-auto">
							{projects.map((project) => (
								<label key={project.id} className="flex items-center gap-2">
									<Checkbox
										checked={selectedProjectIds.has(project.id)}
										onCheckedChange={() => toggleProject(project.id)}
									/>
									<span className="text-sm">{project.name}</span>
								</label>
							))}
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setOpen(false)}>
							{t("cancel")}
						</Button>
						<Button onClick={handleSave} disabled={isPending}>
							{isPending ? t("saving") : t("save")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
