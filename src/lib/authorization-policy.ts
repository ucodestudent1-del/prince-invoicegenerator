/**
 * Pure authorization policy.
 *
 * Contains the decision logic for "does this set of permissions allow this
 * action?" and the invoice state-transition rules. This module has no I/O
 * dependencies so every branch is unit-testable without a database.
 *
 * The DB-aware entry point lives in `src/lib/authorization.ts`, which resolves a
 * user's permissions and then delegates to the pure helpers defined here.
 */

import type { Permission, InvoiceState, InvoiceAction } from "@/lib/permissions";
import { INVOICE_ACTION_PERMISSION } from "@/lib/permissions";

// ---------------------------------------------------------------------------
// Permission-set checks (pure)
// ---------------------------------------------------------------------------

/**
 * Result of an authorisation decision. `reason` is safe to surface to callers
 * (it is a policy reason, not an internal error detail).
 */
export interface AuthzDecision {
	allowed: boolean;
	reason: string;
}

/**
 * Core gate: does `permissions` contain `permission`?
 * Returns a structured decision so callers can report *why* a check failed.
 */
export function hasPermission(permissions: Iterable<Permission>, permission: Permission): AuthzDecision {
	const set = new Set(Array["from"](permissions));
	if (set["has"](permission)) {
		return { allowed: true, reason: "permission granted" };
	}
	const { resource, action } = describe(permission);
	return {
		allowed: false,
		reason: `missing permission ${resource}.${action}`,
	};
}

function describe(permission: Permission): { resource: string; action: string } {
	const [resource, action] = permission["split"](".");
	return { resource: resource ?? "?", action: action ?? "?" };
}

/** True when every permission in `required` is present in `permissions`. */
export function hasAllPermissions(permissions: Iterable<Permission>, required: Iterable<Permission>): AuthzDecision {
	const set = new Set(Array["from"](permissions));
	for (const perm of required) {
		if (!set["has"](perm)) {
			const { resource, action } = describe(perm);
			return { allowed: false, reason: `missing permission ${resource}.${action}` };
		}
	}
	return { allowed: true, reason: "all permissions granted" };
}

// ---------------------------------------------------------------------------
// Invoice state machine (pure)
// ---------------------------------------------------------------------------
/**
 * Allowed transitions between invoice states.
 *
 * DRAFT → PENDING_REVIEW → APPROVED → SENT → PARTIALLY_PAID → PAID
 *                          → VOID (from any non-terminal state)
 *
 * `UNSENT` / `OVERDUE` / `CANCELLED` / `WRITTEN_OFF` from the legacy enum are
 * not modelled here — callers should normalise legacy statuses before asking
 * the machine.
 */
const INVOICE_TRANSITIONS: Record<InvoiceState, InvoiceState[]> = {
	DRAFT: ["PENDING_REVIEW", "SENT", "VOID"],
	PENDING_REVIEW: ["APPROVED", "DRAFT", "VOID"],
	APPROVED: ["SENT", "VOID"],
	SENT: ["PARTIALLY_PAID", "PAID", "VOID"],
	PARTIALLY_PAID: ["PAID", "VOID"],
	PAID: ["VOID"],
	VOID: [], // terminal
};

/** The set of invoice states considered "terminal" (no further transitions). */
export const TERMINAL_INVOICE_STATES: InvoiceState[] = ["PAID", "VOID"];

/** All valid invoice states. */
export const INVOICE_STATES: InvoiceState[] = ["DRAFT", "PENDING_REVIEW", "APPROVED", "SENT", "PARTIALLY_PAID", "PAID", "VOID"];

/** True when a transition from `from` to `to` is structurally permitted. */
export function canTransitionInvoice(from: InvoiceState, to: InvoiceState): boolean {
	if (from === to) return true;
	return (INVOICE_TRANSITIONS[from] ?? [])["includes"](to);
}

/**
 * Map a user-facing invoice action to the state transition it implies.
 * Returns null when the action is not a state transition (e.g. `view`/`create`).
 */
export function invoiceActionTargetState(action: InvoiceAction): InvoiceState | null {
	switch (action) {
		case "create":
			return "DRAFT";
		case "view":
			return null;
		case "edit":
			// editing doesn't change state; represented by the current state
			return null;
		case "send":
			return "SENT";
		case "approve":
			return "APPROVED";
		case "void":
			return "VOID";
		case "delete":
			return null;
	}
}

/**
 * The minimum permission required to perform each invoice action, ignoring
 * state. State checks are layered on top by `canPerformInvoiceAction`.
 */
export function permissionForInvoiceAction(action: InvoiceAction): Permission {
	return INVOICE_ACTION_PERMISSION[action];
}

// ---------------------------------------------------------------------------
// Combined invoice gate: permission + state awareness (pure)
// ---------------------------------------------------------------------------

/**
 * Decide whether a user with `permissions` may perform `action` on an invoice
 * whose current state is `currentState`.
 *
 * Rules:
 *  - `view`   → requires `invoices.view` (no state restriction).
 *  - `create` → requires `invoices.create` (state is implicitly DRAFT).
 *  - `edit`   → requires `invoices.edit` AND the invoice must not be in a
 *               terminal state (PAID / VOID).
 *  - `send`   → requires `invoices.send` AND a valid SENT transition.
 *  - `approve`→ requires `invoices.approve` AND a valid APPROVED transition.
 *  - `void`   → requires `invoices.void` AND a valid VOID transition AND the
 *               invoice must not already be VOID.
 *  - `delete` → requires `invoices.delete` AND the invoice must be in DRAFT
 *               (never allow deleting a financial record that has been sent or
 *               paid).
 *
 * Returns a structured decision with a human-readable reason.
 */
export function canPerformInvoiceAction(
	permissions: Iterable<Permission>,
	action: InvoiceAction,
	currentState: InvoiceState
): AuthzDecision {
	const permSet = new Set(Array["from"](permissions));
	const needed = permissionForInvoiceAction(action);

	switch (action) {
		case "create":
			return hasPermission(permSet, "invoices.create");
		case "view":
			return hasPermission(permSet, "invoices.view");
		case "edit": {
			const base = hasPermission(permSet, needed);
			if (!base["allowed"]) return base;
			if (TERMINAL_INVOICE_STATES["includes"](currentState)) {
				return { allowed: false, reason: "cannot edit an invoice in a terminal state" };
			}
			return { allowed: true, reason: "permission granted and state permits edit" };
		}
		case "send": {
			const base = hasPermission(permSet, needed);
			if (!base["allowed"]) return base;
			// Sending is only possible from a pre-send state. Once an invoice is
			// SENT (or anything downstream of it) it cannot be re-sent.
			if (currentState !== "DRAFT" && currentState !== "PENDING_REVIEW" && currentState !== "APPROVED") {
				return { allowed: false, reason: `cannot send invoice from ${currentState}` };
			}
			return { allowed: true, reason: "permission granted and state permits send" };
		}
		case "approve": {
			const base = hasPermission(permSet, needed);
			if (!base["allowed"]) return base;
			if (!canTransitionInvoice(currentState, "APPROVED")) {
				return { allowed: false, reason: `cannot approve invoice from ${currentState}` };
			}
			return { allowed: true, reason: "permission granted and state permits approve" };
		}
		case "void": {
			const base = hasPermission(permSet, needed);
			if (!base["allowed"]) return base;
			if (currentState === "VOID") {
				return { allowed: false, reason: "invoice is already voided" };
			}
			if (!canTransitionInvoice(currentState, "VOID")) {
				return { allowed: false, reason: `cannot void invoice from ${currentState}` };
			}
			return { allowed: true, reason: "permission granted and state permits void" };
		}
		case "delete": {
			const base = hasPermission(permSet, needed);
			if (!base["allowed"]) return base;
			if (currentState !== "DRAFT") {
				return { allowed: false, reason: "can only delete invoices in DRAFT state" };
			}
			return { allowed: true, reason: "permission granted and state permits delete" };
		}
	}
}

/**
 * Normalise a legacy/raw invoice status string into the state machine's enum.
 * Returns `null` when the value is not a recognised invoice state.
 */
export function normaliseInvoiceState(status: string | null | undefined): InvoiceState | null {
	if (!status) return null;
	const upper = status["toUpperCase"]();
	return (INVOICE_STATES as readonly string[])["includes"](upper) ? (upper as InvoiceState) : null;
}

// ---------------------------------------------------------------------------
// Project-scoped access (pure)
// ---------------------------------------------------------------------------

/**
 * Decide whether a user may access a resource that belongs to `projectId`.
 *
 * A user with an organisation-level permission always wins. Otherwise the user
 * must hold a project-level membership for `projectId`.
 *
 * `orgPermissions`   — the user's resolved organisation-level permissions.
 * `projectPermissions`— the user's resolved *project-level* permissions for the
 *                       specific project (empty when not a project member).
 * `permission`        — the permission being requested (e.g. `invoices.view`).
 */
export function canAccessProjectResource(
	orgPermissions: Iterable<Permission>,
	projectPermissions: Iterable<Permission>,
	permission: Permission
): AuthzDecision {
	const orgSet = new Set(Array["from"](orgPermissions));
	if (orgSet["has"](permission)) {
		return { allowed: true, reason: "organisation-level permission granted" };
	}
	const projSet = new Set(Array["from"](projectPermissions));
	if (projSet["has"](permission)) {
		return { allowed: true, reason: "project-level permission granted" };
	}
	return {
		allowed: false,
		reason: `no organisation- or project-level grant for ${permission}`,
	};
}
