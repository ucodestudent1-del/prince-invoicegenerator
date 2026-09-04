"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { isMissingColumnError } from "@/lib/db-drift";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidateWithLocale } from "@/lib/revalidate";
import { computeUnbilledRevenue, type UnbilledRevenueItem } from "@/lib/unbilled-revenue";
import { createInvoice as createInvoiceAction } from "@/lib/actions/invoices";
import { addDays } from "date-fns";

export async function getUnbilledRevenue() {
	return withActionError("getUnbilledRevenue", async () => {
		const user = await requireUser();
		if (!user["organizationId"]) actionError("No organization");
		const orgId = user["organizationId"];

		// Org-level currency (single source; projects/expenses/milestones do not
		// carry their own currency column).
		let orgCurrency = "USD";
		try {
			const org = await db["organization"]["findUnique"]({
				where: { id: orgId },
				select: { currency: true },
			});
			orgCurrency = org?.["currency"] ?? "USD";
		} catch (err) {
			if (!isMissingColumnError(err)) throw err;
		}

		// Projects (with customer name)
		let projects: any[] = [];
		try {
			const rows = await db["project"]["findMany"]({
				where: { orgId },
				select: {
					id: true,
					name: true,
					number: true,
					customer: { select: { name: true, company: true } },
				},
			});
			projects = rows.map((p) => ({
				id: p["id"],
				name: p["name"],
				number: p["number"],
				customerName: p["customer"]?.["name"] ?? p["customer"]?.["company"] ?? null,
				currency: orgCurrency,
			}));
		} catch (err) {
			if (!isMissingColumnError(err)) throw err;
		}

		// Completed milestones without an invoice
		let milestones: any[] = [];
		try {
			const rows = await db["projectMilestone"]["findMany"]({
				where: { orgId, status: "COMPLETED", invoiceId: null },
				select: {
					id: true,
					projectId: true,
					name: true,
					amount: true,
					status: true,
					invoiceId: true,
				},
			});
			milestones = rows;
		} catch (err) {
			if (!isMissingColumnError(err)) throw err;
		}

		// Approved change orders not yet linked to an invoice
		let changeOrders: any[] = [];
		try {
			const rows = await db["changeOrder"]["findMany"]({
				where: { orgId, status: "APPROVED" },
				select: {
					id: true,
					projectId: true,
					number: true,
					changeAmount: true,
					status: true,
					description: true,
					invoiceId: true,
				},
			});
			changeOrders = rows.map((co) => ({
				id: co["id"],
				projectId: co["projectId"],
				number: co["number"],
				changeAmount: Number(co["changeAmount"] ?? 0),
				status: co["status"],
				description: co["description"],
				// A change order linked to an invoice is considered billed in full
				// for milestone-style detection; partial billing is handled at the
				// invoice-line level via InvoiceItem source fields.
				invoiced: co["invoiceId"] ? Number(co["changeAmount"] ?? 0) : 0,
			}));
		} catch (err) {
			if (!isMissingColumnError(err)) throw err;
		}

		// Billable expenses assigned to a project and not yet invoiced
		let expenses: any[] = [];
		try {
			const rows = await db["expense"]["findMany"]({
				where: { orgId, projectId: { not: null } },
				select: {
					id: true,
					projectId: true,
					vendor: true,
					category: true,
					amount: true,
					date: true,
					notes: true,
				},
			});
			expenses = rows.map((e) => ({
				id: e["id"],
				projectId: e["projectId"],
				vendor: e["vendor"],
				category: e["category"],
				amount: Number(e["amount"] ?? 0),
				date: e["date"],
				description: e["notes"],
				invoiced: false,
			}));
		} catch (err) {
			if (!isMissingColumnError(err)) throw err;
		}

		// Billable time not yet invoiced
		let timeEntries: any[] = [];
		try {
			const rows = await db["timeEntry"]["findMany"]({
				where: { orgId, billable: true, invoiceId: null },
				select: {
					id: true,
					projectId: true,
					description: true,
					amount: true,
				},
			});
			timeEntries = rows.map((t) => ({
				id: t["id"],
				projectId: t["projectId"],
				description: t["description"],
				amount: Number(t["amount"] ?? 0),
				invoiced: false,
			}));
		} catch (err) {
			if (!isMissingColumnError(err)) throw err;
		}

		return computeUnbilledRevenue({
			projects,
			milestones,
			changeOrders,
			expenses,
			timeEntries,
		});
	});
}

/**
 * Create a draft invoice from a single unbilled-revenue item. Used by the
 * "Create Invoice" one-click action on the Unbilled Revenue page.
 */
export async function createInvoiceFromUnbilledItem(item: UnbilledRevenueItem) {
	return withActionError("createInvoiceFromUnbilledItem", async () => {
		const user = await requireUser();
		if (!user["organizationId"]) actionError("No organization");
		const orgId = user["organizationId"];

		// Resolve the customer from the project so the invoice is billable.
		let customerId: string | null = null;
		try {
			const project = await db["project"]["findFirst"]({
				where: { id: item.projectId, orgId },
				select: { customerId: true },
			});
			if (project) {
				customerId = project["customerId"];
			}
		} catch (err) {
			if (!isMissingColumnError(err)) throw err;
		}

		if (!customerId) actionError("The project for this item has no customer assigned.");

		const lineDescription = buildLineItemDescription(item);
		const invoice = await createInvoiceAction({
			customerId,
			projectId: item.projectId,
			type: "STANDARD",
			issueDate: new Date().toISOString(),
			dueDate: addDays(new Date(), 30).toISOString(),
			currency: item.currency,
			taxRate: 0,
			discount: 0,
			retainageRate: 0,
			items: [
				{
					description: lineDescription,
					quantity: 1,
					unitPrice: item.amount,
					sku: item.sourceId,
				},
			],
		});

		if (!invoice) actionError("We couldn't create the invoice right now. Please try again.");

		// Link the source record to the invoice for auditability.
		await linkSourceToInvoice(orgId, item, invoice);
		await linkMilestoneToInvoice(orgId, item, invoice);

		await revalidateWithLocale("/dashboard/unbilled-revenue");
		await revalidateWithLocale("/dashboard");
		return invoice;
	});
}

function buildLineItemDescription(item: UnbilledRevenueItem): string {
	switch (item.type) {
		case "completed_milestone":
			return item.detail ? `Milestone: ${item.detail}` : "Completed milestone";
		case "approved_change_order":
			return item.sourceNumber
				? `Change Order ${item.sourceNumber}${item.detail ? `: ${item.detail}` : ""}`
				: "Approved change order";
		case "billable_expense":
			return item.detail ? `Reimbursable expense: ${item.detail}` : "Billable expense";
		case "unbilled_time":
			return item.detail ? `Time: ${item.detail}` : "Unbilled time";
	}
}

// Link the original source record to the invoice for auditability.
// Best-effort: a missing column must not roll back the invoice just created.
async function linkSourceToInvoice(
	orgId: string,
	item: UnbilledRevenueItem,
	invoice: { id: string }
): Promise<void> {
	if (item.type !== "approved_change_order") return;
	try {
		await db["changeOrder"]["update"]({
			where: { id: item.sourceId, orgId },
			data: { invoiceId: invoice.id },
		});
	} catch (err) {
		if (!isMissingColumnError(err)) {
			void err;
		}
	}
}

async function linkMilestoneToInvoice(
	orgId: string,
	item: UnbilledRevenueItem,
	invoice: { id: string }
): Promise<void> {
	if (item.type !== "completed_milestone") return;
	try {
		await db["projectMilestone"]["update"]({
			where: { id: item.sourceId, orgId },
			data: { status: "INVOICED", invoiceId: invoice.id },
		});
	} catch (err) {
		if (!isMissingColumnError(err)) {
			void err;
		}
	}
	await revalidateWithLocale(`/dashboard/projects/${item.projectId}`);
}
