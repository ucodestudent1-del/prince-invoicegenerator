"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { isMissingColumnError } from "@/lib/db-drift";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidateWithLocale } from "@/lib/revalidate";
import { canTransition, type AnyStatus, type ChangeOrderStatus } from "@/lib/document-workflow";
import { randomUUID } from "crypto";

interface UpdateChangeOrderInput {
	title?: string;
	description?: string | null;
	amount?: number;
	projectId?: string | null;
	invoiceId?: string | null;
	status?: ChangeOrderStatus;
}

async function logChangeOrderAudit(
	changeOrderId: string,
	orgId: string,
	action: string,
	fromStatus: string | null,
	toStatus: string | null,
	note?: string,
	userId?: string | null
) {
	try {
		await db["changeOrderAudit"]["create"]({
			data: {
				orgId,
				changeOrderId,
				action,
				fromStatus: fromStatus as ChangeOrderStatus | null,
				toStatus: toStatus as ChangeOrderStatus | null,
				changedBy: userId ?? null,
				metadata: note ? { note } : undefined,
			},
		});
	} catch (err) {
		if (isMissingColumnError(err)) {
			return;
		}
		throw err;
	}
}

export async function getChangeOrders(opts?: { skip?: number; take?: number }) {
	const skip = opts?.["skip"] ?? 0;
	const take = opts?.["take"] ?? 50;
	return withActionError("getChangeOrders", async () => {
		const user = await requireUser();
		if (!user["organizationId"]) actionError("No organization");
		const orgId = user["organizationId"];

		try {
			const [changeOrders, total] = await Promise.all([
				db["changeOrder"]["findMany"]({
					where: { orgId },
					orderBy: { createdAt: "desc" },
					include: {
						project: true,
						invoice: { select: { id: true, number: true, status: true, total: true } },
					},
					skip,
					take,
				}),
				db["changeOrder"]["count"]({ where: { orgId } }),
			]);
			return { changeOrders, total };
		} catch (err) {
			if (isMissingColumnError(err)) {
				const [changeOrders, total] = await Promise.all([
					db["changeOrder"]["findMany"]({
						where: { orgId },
						orderBy: { createdAt: "desc" },
						select: {
							id: true,
							number: true,
							title: true,
							description: true,
							amount: true,
							status: true,
							createdAt: true,
							updatedAt: true,
							projectId: true,
							project: { select: { id: true, name: true } },
						},
						skip,
						take,
					}),
					db["changeOrder"]["count"]({ where: { orgId } }),
				]);
				return { changeOrders, total };
			}
			throw err;
		}
	});
}

export async function getChangeOrderDetail(changeOrderId: string) {
	return withActionError("getChangeOrderDetail", async () => {
		const user = await requireUser();
		if (!user["organizationId"]) actionError("No organization");
		const orgId = user["organizationId"];

		try {
			const changeOrder = await db["changeOrder"]["findFirst"]({
				where: { id: changeOrderId, orgId },
				include: {
					project: true,
					invoice: { select: { id: true, number: true, status: true, total: true } },
					items: true,
						auditLogs: { orderBy: { changedAt: "desc" } },
				},
			});
			return changeOrder;
		} catch (err) {
			if (isMissingColumnError(err)) {
				const changeOrder = await db["changeOrder"]["findFirst"]({
					where: { id: changeOrderId, orgId },
					select: {
						id: true,
						number: true,
						title: true,
						description: true,
						amount: true,
						changeAmount: true,
						originalTotal: true,
						revisedTotal: true,
						status: true,
						createdAt: true,
						updatedAt: true,
						issueDate: true,
						projectId: true,
						invoiceId: true,
						customerId: true,
						billToAddress: true,
						daysAdded: true,
						originalCompletionDate: true,
						newCompletionDate: true,
						scopeChangeDescription: true,
						scheduleImpactDescription: true,
						project: { select: { id: true, name: true, number: true } },
						invoice: { select: { id: true, number: true, status: true, total: true } },
					},
				});
				return changeOrder;
			}
			throw err;
		}
	});
}

export async function updateChangeOrder(changeOrderId: string, input: UpdateChangeOrderInput) {
	return withActionError("updateChangeOrder", async () => {
		const user = await requireUser();
		if (!user["organizationId"]) actionError("No organization");
		const orgId = user["organizationId"];

		const changeOrder = await db["changeOrder"]["findFirst"]({
			where: { id: changeOrderId, orgId },
			select: { id: true, status: true },
		});
		if (!changeOrder) actionError("Change order not found");

		const previousStatus = changeOrder["status"];
		const updates: Record<string, unknown> = {};

		if (input["title"] !== undefined) updates["title"] = input["title"];
		if (input["description"] !== undefined) updates["description"] = input["description"];
		if (input["amount"] !== undefined) updates["amount"] = input["amount"];
		if (input["projectId"] !== undefined) updates["projectId"] = input["projectId"];

		if (input["invoiceId"] !== undefined) {
			if (input["invoiceId"] !== null) {
				const invoiceExists = await db["invoice"]["findFirst"]({
					where: { id: input["invoiceId"]!, orgId },
					select: { id: true },
				});
				if (!invoiceExists) actionError("Invoice not found");
			}
			updates["invoiceId"] = input["invoiceId"];
		}

		if (input["status"] !== undefined && input["status"] !== previousStatus) {
			updates["status"] = input["status"];
		}

		const updated = await db["changeOrder"]["update"]({
			where: { id: changeOrderId, orgId },
			data: updates,
		});

		if (input["status"] !== undefined && input["status"] !== previousStatus) {
			await logChangeOrderAudit(
				changeOrderId,
				orgId,
				"STATUS_CHANGE",
				previousStatus,
				input["status"] ?? null,
				`Status changed from ${previousStatus} to ${input["status"]}`,
				user["id"]
			);
			await revalidateWithLocale(`/dashboard/change-orders/${changeOrderId}`);
		}

		await revalidateWithLocale("/dashboard/change-orders");
		await revalidateWithLocale(`/dashboard/change-orders/${changeOrderId}`);
		return updated;
	});
}

export async function transitionChangeOrder(changeOrderId: string, action: string) {
	return withActionError("transitionChangeOrder", async () => {
		const user = await requireUser();
		if (!user["organizationId"]) actionError("No organization");
		const orgId = user["organizationId"];

		let changeOrder;
		try {
			changeOrder = await db["changeOrder"]["findFirst"]({
				where: { id: changeOrderId, orgId },
				select: { id: true, status: true, number: true },
			});
		} catch (err) {
			if (isMissingColumnError(err)) {
				changeOrder = await db["changeOrder"]["findFirst"]({
					where: { id: changeOrderId, orgId },
					select: { id: true, status: true },
				});
			} else {
				throw err;
			}
		}
		if (!changeOrder) actionError("Change order not found");

		const result = canTransition("change_order", changeOrder["status"] as AnyStatus, action);
		if (!result["allowed"]) {
			actionError(result["reason"] ?? `Cannot ${action} this change order`);
		}

		const newStatus = result["transition"]!["to"] as ChangeOrderStatus;
		const previousStatus = changeOrder["status"];

		try {
			await db["changeOrder"]["update"]({
				where: { id: changeOrderId, orgId },
				data: { status: newStatus },
			});
		} catch (err) {
			if (isMissingColumnError(err)) {
				await db["changeOrder"]["update"]({
					where: { id: changeOrderId, orgId },
					data: { status: newStatus as any },
				});
			} else {
				throw err;
			}
		}

		const actionLabel = action.toUpperCase();
		await logChangeOrderAudit(
			changeOrderId,
			orgId,
			`CHANGE_ORDER_${actionLabel}`,
			previousStatus,
			newStatus,
			undefined,
			user["id"]
		);

		await revalidateWithLocale(`/dashboard/change-orders/${changeOrderId}`);
		await revalidateWithLocale("/dashboard/change-orders");

		return {
			changeOrderId,
			previousStatus,
			newStatus,
			sideEffect: result["sideEffect"],
		};
	});
}

export async function getChangeOrderAuditLogs(changeOrderId: string) {
	return withActionError("getChangeOrderAuditLogs", async () => {
		const user = await requireUser();
		if (!user["organizationId"]) actionError("No organization");
		const orgId = user["organizationId"];

		const changeOrder = await db["changeOrder"]["findFirst"]({
			where: { id: changeOrderId, orgId },
			select: { id: true },
		});
		if (!changeOrder) actionError("Change order not found");

		try {
			const logs = await db["changeOrderAudit"]["findMany"]({
				where: { changeOrderId, orgId },
				orderBy: { changedAt: "desc" },
				select: {
					id: true,
					action: true,
					fromStatus: true,
					toStatus: true,
					metadata: true,
					changedBy: true,
					changedAt: true,
				},
			});
			return logs;
		} catch (err) {
			if (isMissingColumnError(err)) {
				return [];
			}
			throw err;
		}
	});
}

export async function deleteChangeOrder(changeOrderId: string) {
	return withActionError("deleteChangeOrder", async () => {
		const user = await requireUser();
		if (!user["organizationId"]) actionError("No organization");
		const orgId = user["organizationId"];

		const changeOrder = await db["changeOrder"]["findFirst"]({
			where: { id: changeOrderId, orgId },
			select: { id: true, status: true },
		});
		if (!changeOrder) actionError("Change order not found");

		const result = canTransition("change_order", changeOrder["status"] as AnyStatus, "cancel");
		if (!result["allowed"]) {
			actionError("Only draft or pending change orders can be deleted");
		}

		await db["changeOrder"]["delete"]({
			where: { id: changeOrderId, orgId },
		});

		await logChangeOrderAudit(
			changeOrderId,
			orgId,
			"DELETED",
			changeOrder["status"],
			null,
			undefined,
			user["id"]
		);

		await revalidateWithLocale("/dashboard/change-orders");
		return { success: true };
	});
}
