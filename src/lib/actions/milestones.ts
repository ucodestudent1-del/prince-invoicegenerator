"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { isMissingColumnError } from "@/lib/db-drift";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidateWithLocale } from "@/lib/revalidate";
import { roundMoney } from "@/lib/money";
import type { MilestoneStatus } from "@/lib/milestones";

export interface CreateMilestoneInput {
	projectId: string;
	name: string;
	description?: string | null;
	amount: number;
	dueDate?: string | null;
}

export interface UpdateMilestoneInput {
	name?: string;
	description?: string | null;
	amount?: number;
	dueDate?: string | null;
	status?: MilestoneStatus;
}

const ACTIVE_INVOICE_STATUSES = new Set(["DRAFT", "SENT", "VIEWED", "PARTIALLY_PAID", "PAID", "UNPAID", "OVERDUE"]);

export async function getMilestones(projectId: string) {
	return withActionError("getMilestones", async () => {
		const user = await requireUser();
		if (!user["organizationId"]) actionError("No organization");
		const orgId = user["organizationId"];

		const project = await db["project"]["findFirst"]({
			where: { id: projectId, orgId },
			select: { id: true },
		});
		if (!project) actionError("Project not found");

		let milestones: any[];
		try {
			milestones = await db["projectMilestone"]["findMany"]({
				where: { orgId, projectId },
				orderBy: { dueDate: "asc", createdAt: "asc" },
				select: {
					id: true,
					projectId: true,
					name: true,
					description: true,
					amount: true,
					dueDate: true,
					status: true,
					completedAt: true,
					invoiceId: true,
					createdAt: true,
					updatedAt: true,
					invoice: { select: { id: true, number: true, status: true } },
				},
			});
		} catch (err) {
			if (!isMissingColumnError(err)) throw err;
			milestones = [];
		}

		return milestones;
	});
}

export async function createMilestone(input: CreateMilestoneInput) {
	return withActionError("createMilestone", async () => {
		const user = await requireUser();
		if (!user["organizationId"]) actionError("No organization");
		const orgId = user["organizationId"];

		const project = await db["project"]["findFirst"]({
			where: { id: input["projectId"], orgId },
			select: { id: true },
		});
		if (!project) actionError("Project not found");

		if (!input["name"] || input["name"]["trim"]() === "") {
			actionError("Milestone name is required.");
		}
		if (input["amount"] < 0) actionError("Milestone amount cannot be negative.");

		let milestone;
		try {
			milestone = await db["projectMilestone"]["create"]({
				data: {
					orgId,
					projectId: input["projectId"],
					name: input["name"],
					description: input["description"] ?? null,
					amount: roundMoney(input["amount"]),
					dueDate: input["dueDate"] ? new Date(input["dueDate"]) : null,
					status: "PENDING" as MilestoneStatus,
				},
			});
		} catch (err) {
			if (!isMissingColumnError(err)) throw err;
			milestone = await db["projectMilestone"]["create"]({
				data: {
					orgId,
					projectId: input["projectId"],
					name: input["name"],
					amount: roundMoney(input["amount"]),
				},
			});
		}

		await revalidateWithLocale(`/dashboard/projects/${input["projectId"]}`);
		return milestone;
	});
}

export async function completeMilestone(milestoneId: string) {
	return withActionError("completeMilestone", async () => {
		const user = await requireUser();
		if (!user["organizationId"]) actionError("No organization");
		const orgId = user["organizationId"];

		const milestone = await db["projectMilestone"]["findFirst"]({
			where: { id: milestoneId, orgId },
			select: { id: true, projectId: true, status: true, invoiceId: true, completedAt: true },
		});
		if (!milestone) actionError("Milestone not found");
		if (milestone["status"] === "INVOICED") actionError("Already invoiced milestones cannot be changed.");
		if (milestone["status"] === "CANCELLED") actionError("Cancelled milestones cannot be completed.");

		await db["projectMilestone"]["update"]({
			where: { id: milestoneId, orgId },
			data: {
				status: milestone["invoiceId"] ? "INVOICED" : "COMPLETED",
				completedAt: milestone["invoiceId"] ? milestone["completedAt"] : new Date(),
			},
		});

		await revalidateWithLocale(`/dashboard/projects/${milestone["projectId"]}`);
		await revalidateWithLocale("/dashboard/unbilled-revenue");
		await revalidateWithLocale("/dashboard");
		return { success: true };
	});
}

export async function markMilestoneInvoiced(milestoneId: string, invoiceId: string) {
	return withActionError("markMilestoneInvoiced", async () => {
		const user = await requireUser();
		if (!user["organizationId"]) actionError("No organization");
		const orgId = user["organizationId"];

		const milestone = await db["projectMilestone"]["findFirst"]({
			where: { id: milestoneId, orgId },
			select: { id: true, projectId: true, status: true },
		});
		if (!milestone) actionError("Milestone not found");

		const invoice = await db["invoice"]["findFirst"]({
			where: { id: invoiceId, orgId },
			select: { id: true, status: true },
		});
		if (!invoice) actionError("Invoice not found");

		await db["projectMilestone"]["update"]({
			where: { id: milestoneId, orgId },
			data: { status: "INVOICED" as MilestoneStatus, invoiceId },
		});

		await revalidateWithLocale(`/dashboard/projects/${milestone["projectId"]}`);
		await revalidateWithLocale("/dashboard/unbilled-revenue");
		await revalidateWithLocale("/dashboard");
		return { success: true };
	});
}

export async function deleteMilestone(milestoneId: string) {
	return withActionError("deleteMilestone", async () => {
		const user = await requireUser();
		if (!user["organizationId"]) actionError("No organization");
		const orgId = user["organizationId"];

		const milestone = await db["projectMilestone"]["findFirst"]({
			where: { id: milestoneId, orgId },
			select: { id: true, projectId: true, status: true },
		});
		if (!milestone) actionError("Milestone not found");
		if (milestone["status"] === "INVOICED") actionError("Invoiced milestones cannot be deleted.");

		await db["projectMilestone"]["delete"]({
			where: { id: milestoneId, orgId },
		});

		await revalidateWithLocale(`/dashboard/projects/${milestoneId}`);
		await revalidateWithLocale(`/dashboard/projects/${milestone["projectId"]}`);
		await revalidateWithLocale("/dashboard/unbilled-revenue");
		await revalidateWithLocale("/dashboard");
		return { success: true };
	});
}
