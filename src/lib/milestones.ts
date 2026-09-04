/**
 * Project milestone calculations.
 *
 * A milestone is a discrete, billable phase of a project. Its lifecycle is:
 *   PENDING → COMPLETED → INVOICED
 *
 * A COMPLETED milestone that has not yet been invoiced is "available to bill"
 * and feeds directly into the Unbilled Revenue feature.
 */

import { roundMoney, sumMoney } from "@/lib/money";

export type MilestoneStatus = "PENDING" | "COMPLETED" | "INVOICED" | "CANCELLED";

export interface MilestoneInput {
	id: string;
	projectId: string;
	name: string;
	amount: number;
	status: MilestoneStatus;
	completedAt?: Date | string | null;
	dueDate?: Date | string | null;
	invoiceId?: string | null;
}

export interface MilestoneSummary {
	total: number;
	pending: number;
	completed: number;
	invoiced: number;
	cancelled: number;
	/** Work completed but not yet invoiced — eligible for unbilled-revenue billing. */
	completedNotInvoiced: number;
	/** Percentage of the total milestone value already invoiced. */
	progressPercent: number;
}

/**
 * Derive the effective milestone status. A COMPLETED milestone that has been
 * tied to an invoice is effectively INVOICED regardless of the stored value, so
 * the COMPLETED/INVOICED buckets stay mutually exclusive.
 */
export function effectiveMilestoneStatus(m: MilestoneInput): MilestoneStatus {
	if (m["status"] === "CANCELLED") return "CANCELLED";
	if (m["status"] === "INVOICED" || m["invoiceId"] != null) return "INVOICED";
	if (m["status"] === "COMPLETED") return "COMPLETED";
	return m["status"];
}

/**
 * Summarise a project's milestones into billable/progress aggregates.
 *
 * Bucket semantics (cumulative, by raw stage):
 *  - `pending`  : work not yet started/completed.
 *  - `completed`: ALL milestones whose stored status is COMPLETED — this is a
 *    cumulative "work done" counter that includes milestones already billed.
 *  - `invoiced`  : milestones that have been billed (effective INVOICED: a
 *    stored INVOICED status, or COMPLETED tied to an invoice).
 *  - `completedNotInvoiced` = completed work still awaiting billing.
 *  - `progressPercent` = invoiced / total.
 */
export function computeMilestoneSummary(milestones: MilestoneInput[]): MilestoneSummary {
	const total = sumMoney(milestones.map((m) => m["amount"]));
	const pending = sumMoney(milestones.filter((m) => m["status"] === "PENDING").map((m) => m["amount"]));
	const completed = sumMoney(milestones.filter((m) => m["status"] === "COMPLETED").map((m) => m["amount"]));
	const invoiced = sumMoney(
		milestones.filter((m) => effectiveMilestoneStatus(m) === "INVOICED").map((m) => m["amount"])
	);
	const cancelled = sumMoney(milestones.filter((m) => m["status"] === "CANCELLED").map((m) => m["amount"]));
	const completedNotInvoiced = sumMoney(
		milestones.filter((m) => m["status"] === "COMPLETED" && m["invoiceId"] == null).map((m) => m["amount"])
	);

	const progressPercent = total > 0 ? roundMoney((invoiced / total) * 100) : 0;

	return {
		total,
		pending,
		completed,
		invoiced,
		cancelled,
		completedNotInvoiced,
		progressPercent,
	};
}

/**
 * List milestones that are completed but not yet invoiced — i.e. the billable,
 * unbilled revenue attributable to milestone completion. Sorted by due date
 * ascending (earliest first); milestones without a due date sort last because
 * they carry no urgency signal for time-based billing.
 */
export function getUnbilledMilestones(milestones: MilestoneInput[]): MilestoneInput[] {
	return milestones
		.filter((m) => effectiveMilestoneStatus(m) === "COMPLETED")
		.sort((a, b) => {
			const da = a["dueDate"] ? new Date(a["dueDate"])["getTime"]() : Infinity;
			const db = b["dueDate"] ? new Date(b["dueDate"])["getTime"]() : Infinity;
			return da - db;
		});
}
