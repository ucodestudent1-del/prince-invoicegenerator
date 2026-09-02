/**
 * Document workflow state machines.
 *
 * Each of the three business document types has its OWN status set, its OWN
 * legal transitions, and its OWN side effects. Shared base fields (number,
 * customer, dates, currency, totals, notes) do NOT imply identical business
 * semantics:
 *
 *   - Estimate.total  = a *proposed* amount. Accepting it must NOT create an
 *     accounts-receivable balance.
 *   - ChangeOrder.changeAmount = a contractual *delta*. Approving it must NOT
 *     create a receivable or invoice.
 *   - Invoice.total   = the *amount billed* and participates directly in
 *     accounts receivable, payment application, and aging.
 *
 * This module is the single source of truth for:
 *   1. The valid statuses per document type.
 *   2. The legal state transitions per document type.
 *   3. Whether a transition has financial side effects.
 *
 * The transitions are deliberately *declarative* data so they are trivially
 * testable and auditable. No conditional-on-type branching lives in the domain
 * logic itself."
 */

// ---------------------------------------------------------------------------
// Status enumerations (kept as string literals so they survive a Prisma drift
// gracefully and are usable in pure unit tests without a database).
// ---------------------------------------------------------------------------

export const ESTIMATE_STATUSES = [
	"DRAFT",
	"SENT",
	"VIEWED",
	"ACCEPTED",
	"REJECTED",
	"EXPIRED",
	"CANCELLED",
	"CONVERTED",
] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const CHANGE_ORDER_STATUSES = [
	"DRAFT",
	"PENDING_APPROVAL",
	"APPROVED",
	"REJECTED",
	"CANCELLED",
	"VOID",
] as const;
export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUSES)[number];

export const INVOICE_STATUSES = [
	"DRAFT",
	"SENT",
	"VIEWED",
	"PARTIALLY_PAID",
	"PAID",
	"OVERDUE",
	"VOID",
	"CANCELLED",
	"WRITTEN_OFF",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type DocumentType = "estimate" | "change_order" | "invoice";

export type AnyStatus = EstimateStatus | ChangeOrderStatus | InvoiceStatus;

// ---------------------------------------------------------------------------
// Transition tables
// ---------------------------------------------------------------------------

export interface Transition {
	/** Human-readable label, e.g. "send", "accept". */
	action: string;
	/** Statuses this transition is allowed FROM. Empty = any current status. */
	from: AnyStatus[];
	/** The status the document lands in. */
	to: AnyStatus;
	/**
	 * Whether the transition has a direct accounting / receivable side effect.
	 * Estimate acceptance does NOT (no AR). Change Order approval does NOT
	 * (no receivable). Invoice sending/payment does.
	 */
	createsReceivable: boolean;
}

export const ESTIMATE_TRANSITIONS: Record<string, Transition> = {
	// DRAFT → SENT: proposal sent to customer. No receivable.
	send: { action: "send", from: ["DRAFT"], to: "SENT", createsReceivable: false },
	// SENT/VIEWED → VIEWED: customer opened it. Idempotent.
	view: { action: "view", from: ["SENT"], to: "VIEWED", createsReceivable: false },
	// SENT/VIEWED/ACCEPTED → ACCEPTED: customer accepts the proposal.
	// Per spec: "Accepting an estimate must not automatically create an
	// accounts-receivable balance unless the application explicitly creates a
	// separate financial transaction such as a deposit invoice."
	accept: { action: "accept", from: ["SENT", "VIEWED"], to: "ACCEPTED", createsReceivable: false },
	// SENT/VIEWED → REJECTED
	reject: { action: "reject", from: ["SENT", "VIEWED"], to: "REJECTED", createsReceivable: false },
	// DRAFT/SENT/VIEWED/ACCEPTED/REJECTED → CANCELLED
	cancel: {
		action: "cancel",
		from: ["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED"],
		to: "CANCELLED",
		createsReceivable: false,
	},
	// ACCEPTED → CONVERTED (an invoice was generated from this estimate).
	convert: {
		action: "convert",
		from: ["ACCEPTED"],
		to: "CONVERTED",
		createsReceivable: false,
	},
};

export const CHANGE_ORDER_TRANSITIONS: Record<string, Transition> = {
	// DRAFT → PENDING_APPROVAL: submitted for customer/approver review.
	submit: {
		action: "submit",
		from: ["DRAFT"],
		to: "PENDING_APPROVAL",
		createsReceivable: false,
	},
	// PENDING_APPROVAL → APPROVED: approver signs off. This modifies the
	// effective contract scope and value, but does NOT create a receivable or
	// invoice. Only APPROVED change orders modify the effective contract value.
	approve: {
		action: "approve",
		from: ["PENDING_APPROVAL", "DRAFT"],
		to: "APPROVED",
		createsReceivable: false,
	},
	// PENDING_APPROVAL → REJECTED
	reject: {
		action: "reject",
		from: ["PENDING_APPROVAL"],
		to: "REJECTED",
		createsReceivable: false,
	},
	// Any non-terminal → CANCELLED
	cancel: {
		action: "cancel",
		from: ["DRAFT", "PENDING_APPROVAL"],
		to: "CANCELLED",
		createsReceivable: false,
	},
	// APPROVED → VOID (auditable correction of an already-approved order)
	void: {
		action: "void",
		from: ["APPROVED", "DRAFT"],
		to: "VOID",
		createsReceivable: false,
	},
};

export const CHANGE_ORDER_ACTIONS = Object["keys"](CHANGE_ORDER_TRANSITIONS);

export const INVOICE_TRANSITIONS: Record<string, Transition> = {
	// DRAFT → SENT: invoice issued to customer. THIS creates the billing
	// obligation / accounts-receivable balance.
	send: { action: "send", from: ["DRAFT"], to: "SENT", createsReceivable: true },
	// SENT → VIEWED
	view: { action: "view", from: ["SENT"], to: "VIEWED", createsReceivable: false },
	// SENT/VIEWED → OVERDUE (date-based, but the transition itself is a no-op
	// side-effect-wise: overdue is a reflection of time, not a new charge).
	mark_overdue: {
		action: "mark_overdue",
		from: ["SENT", "VIEWED", "PARTIALLY_PAID"],
		to: "OVERDUE",
		createsReceivable: false,
	},
	// Payment received. If fully paid → PAID; partial → PARTIALLY_PAID.
	record_payment: {
		action: "record_payment",
		from: ["DRAFT", "SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"],
		to: "PARTIALLY_PAID",
		createsReceivable: false,
	},
	full_payment: {
		action: "full_payment",
		from: ["DRAFT", "SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"],
		to: "PAID",
		createsReceivable: false,
	},
	// SENT/VIEWED/PARTIALLY_PAID/OVERDUE → VOID (cancellation of a live invoice)
	void: {
		action: "void",
		from: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"],
		to: "VOID",
		createsReceivable: true,
	},
	// VOID/PAID/OVERDUE → CANCELLED
	cancel: {
		action: "cancel",
		from: ["DRAFT", "SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE", "PAID", "VOID"],
		to: "CANCELLED",
		createsReceivable: false,
	},
	// PAID/OVERDUE/PARTIALLY_PAID → WRITTEN_OFF (bad debt)
	write_off: {
		action: "write_off",
		from: ["PAID", "OVERDUE", "PARTIALLY_PAID"],
		to: "WRITTEN_OFF",
		createsReceivable: true,
	},
	// Revert a sent invoice back to draft before it has been paid.
	revert_to_draft: {
		action: "revert_to_draft",
		from: ["SENT", "VIEWED"],
		to: "DRAFT",
		createsReceivable: false,
	},
};

const TRANSITION_TABLES: Record<DocumentType, Record<string, Transition>> = {
	estimate: ESTIMATE_TRANSITIONS,
	change_order: CHANGE_ORDER_TRANSITIONS,
	invoice: INVOICE_TRANSITIONS,
};

export const STATUS_TABLES: Record<DocumentType, readonly string[]> = {
	estimate: ESTIMATE_STATUSES,
	change_order: CHANGE_ORDER_STATUSES,
	invoice: INVOICE_STATUSES,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CanTransitionResult {
	allowed: boolean;
	transition: Transition | null;
	reason?: string;
	/** Whether this transition would directly create/change a receivable. */
	sideEffect?: "create_receivable" | "modify_contract_scope" | "none";
}

/**
 * Determine whether a transition is legal for the given document type.
 *
 * `createsReceivable` on the transition marks financial side effects. For
 * change orders, an APPROVED transition additionally "modifies contract scope"
 * (returned as `sideEffect`) — but it does not create a receivable.
 */
export function canTransition(
	docType: DocumentType,
	currentStatus: AnyStatus,
	action: string
): CanTransitionResult {
	const table = TRANSITION_TABLES[docType];
	const transition = table[action];
	if (!transition) {
		return { allowed: false, transition: null, reason: `Unknown action "${action}"` };
	}
	const fromList = transition["from"];
	if (fromList["length"] > 0 && !fromList["includes"](currentStatus)) {
		return {
			allowed: false,
			transition: null,
			reason: `${currentStatus} cannot be ${action}ed`,
		};
	}

	// Derive the semantic side effect.
	let sideEffect: CanTransitionResult["sideEffect"] = "none";
	if (transition["createsReceivable"]) {
		sideEffect = "create_receivable";
	} else if (docType === "change_order" && transition["to"] === "APPROVED") {
		// Approving a change order modifies the effective contract scope/value
		// but does NOT create a receivable or invoice.
		sideEffect = "modify_contract_scope";
	}

	return {
		allowed: true,
		transition,
		reason: undefined,
		sideEffect,
	};
}

/** True when the status is one of the "final / paid off" statuses. */
export function isTerminalStatus(docType: DocumentType, status: AnyStatus): boolean {
	if (docType === "invoice") {
		return ["PAID", "VOID", "CANCELLED", "WRITTEN_OFF"]["includes"](status as InvoiceStatus);
	}
	if (docType === "estimate") {
		return ["ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED", "CONVERTED"][
			"includes"
		](status as EstimateStatus);
	}
	if (docType === "change_order") {
		return ["APPROVED", "REJECTED", "CANCELLED", "VOID"]["includes"](
			status as ChangeOrderStatus
		);
	}
	return false;
}

/**
 * Whether a document status is "active" in the sense that it still represents
 * an outstanding proposal or obligation.
 */
export function isActiveStatus(docType: DocumentType, status: AnyStatus): boolean {
	if (docType === "invoice") {
		return ["DRAFT", "SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"][
			"includes"
		](status as InvoiceStatus);
	}
	if (docType === "estimate") {
		return ["DRAFT", "SENT", "VIEWED"]["includes"](status as EstimateStatus);
	}
	if (docType === "change_order") {
		return ["DRAFT", "PENDING_APPROVAL"]["includes"](status as ChangeOrderStatus);
	}
	return false;
}

/**
 * Whether a change order's delta counts toward the effective contract value.
 * Only APPROVED change orders modify the contract scope and value; drafts,
 * pending, rejected, and cancelled orders do not.
 */
export function affectsContractValue(status: ChangeOrderStatus): boolean {
	return status === "APPROVED";
}

/**
 * Whether an estimate has been accepted (and thus may become the basis for a
 * project, contract, or invoice). Acceptance does NOT imply any receivable.
 */
export function isEstimateAccepted(status: EstimateStatus): boolean {
	return status === "ACCEPTED";
}

/**
 * Whether an invoice participates in payment / receivable accounting.
 * Estimates and change orders must NOT reach payment logic through this gate.
 */
export function participatesInReceivables(docType: DocumentType): boolean {
	return docType === "invoice";
}
