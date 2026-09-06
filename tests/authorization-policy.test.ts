import { describe, expect, it } from "vitest";
import {
	hasPermission,
	hasAllPermissions,
	canTransitionInvoice,
	canPerformInvoiceAction,
	normaliseInvoiceState,
	canAccessProjectResource,
	TERMINAL_INVOICE_STATES,
	INVOICE_STATES,
} from "@/lib/authorization-policy";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";

const OWNER = DEFAULT_ROLE_PERMISSIONS["owner"];
const ACCOUNTANT = DEFAULT_ROLE_PERMISSIONS["accountant"];
const PM = DEFAULT_ROLE_PERMISSIONS["project_manager"];
const FIELD = DEFAULT_ROLE_PERMISSIONS["field_worker"];

describe("hasPermission (pure permission check)", () => {
	it("grants when the permission is present", () => {
		const r = hasPermission(OWNER, "invoices.create");
		expect(r["allowed"])["toBe"](true);
	});

	it("denies with a descriptive reason when missing", () => {
		const r = hasPermission(FIELD, "invoices.create");
		expect(r["allowed"])["toBe"](false);
		expect(r["reason"])["toContain"]("invoices.create");
	});

	it("works with any iterable", () => {
		const r = hasPermission(new Set(["projects.view"]) as any, "projects.view");
		expect(r["allowed"])["toBe"](true);
	});
});

describe("hasAllPermissions", () => {
	it("grants when all required are present", () => {
		const r = hasAllPermissions(OWNER, ["invoices.view", "invoices.create"]);
		expect(r["allowed"])["toBe"](true);
	});

	it("denies and names the first missing permission", () => {
		const r = hasAllPermissions(PM, ["invoices.view", "invoices.void"]);
		expect(r["allowed"])["toBe"](false);
		expect(r["reason"])["toContain"]("invoices.void");
	});
});

describe("invoice state machine", () => {
	it("allows same-state transitions (no-op)", () => {
		expect(canTransitionInvoice("DRAFT", "DRAFT"))["toBe"](true);
	});

	it("allows the canonical forward flow", () => {
		expect(canTransitionInvoice("DRAFT", "PENDING_REVIEW"))["toBe"](true);
		expect(canTransitionInvoice("PENDING_REVIEW", "APPROVED"))["toBe"](true);
		expect(canTransitionInvoice("APPROVED", "SENT"))["toBe"](true);
		expect(canTransitionInvoice("SENT", "PARTIALLY_PAID"))["toBe"](true);
		expect(canTransitionInvoice("PARTIALLY_PAID", "PAID"))["toBe"](true);
	});

	it("allows void from any non-terminal state", () => {
		for (const state of ["DRAFT", "PENDING_REVIEW", "APPROVED", "SENT", "PARTIALLY_PAID"]) {
			expect(canTransitionInvoice(state as any, "VOID"))["toBe"](true);
		}
	});

	it("does not allow backward transitions", () => {
		expect(canTransitionInvoice("SENT", "DRAFT"))["toBe"](false);
		expect(canTransitionInvoice("APPROVED", "DRAFT"))["toBe"](false);
		expect(canTransitionInvoice("PAID", "SENT"))["toBe"](false);
	});

	it("void is terminal", () => {
		expect(canTransitionInvoice("VOID", "PAID"))["toBe"](false);
		expect(canTransitionInvoice("PAID", "PAID"))["toBe"](true);
	});

	it("PAID can only go to VOID", () => {
		expect(canTransitionInvoice("PAID", "SENT"))["toBe"](false);
		expect(canTransitionInvoice("PAID", "VOID"))["toBe"](true);
	});
});

describe("canPerformInvoiceAction", () => {
	it("owner can perform every action in the appropriate states", () => {
		for (const state of INVOICE_STATES) {
			expect(canPerformInvoiceAction(OWNER, "view", state as any)["allowed"])["toBe"](true);
		}
		expect(canPerformInvoiceAction(OWNER, "send", "DRAFT" as any)["allowed"])["toBe"](true);
		expect(canPerformInvoiceAction(OWNER, "send", "APPROVED" as any)["allowed"])["toBe"](true);
		expect(canPerformInvoiceAction(OWNER, "send", "SENT" as any)["allowed"])["toBe"](false);
		expect(canPerformInvoiceAction(OWNER, "approve", "PENDING_REVIEW" as any)["allowed"])["toBe"](true);
		expect(canPerformInvoiceAction(OWNER, "void", "SENT" as any)["allowed"])["toBe"](true);
		expect(canPerformInvoiceAction(OWNER, "void", "VOID" as any)["allowed"])["toBe"](false);
		expect(canPerformInvoiceAction(OWNER, "edit", "DRAFT" as any)["allowed"])["toBe"](true);
		expect(canPerformInvoiceAction(OWNER, "edit", "PAID" as any)["allowed"])["toBe"](false);
	});

	it("project manager can create invoices (draft)", () => {
		const r = canPerformInvoiceAction(PM, "create", "DRAFT" as any);
		expect(r["allowed"])["toBe"](true);
	});

	it("project manager can send a draft/approved invoice", () => {
		expect(canPerformInvoiceAction(PM, "send", "DRAFT" as any)["allowed"])["toBe"](true);
		expect(canPerformInvoiceAction(PM, "send", "APPROVED" as any)["allowed"])["toBe"](true);
	});

	it("project manager cannot send from SENT (already sent)", () => {
		const r = canPerformInvoiceAction(PM, "send", "SENT" as any);
		expect(r["allowed"])["toBe"](false);
	});

	it("project manager cannot approve invoices", () => {
		const r = canPerformInvoiceAction(PM, "approve", "DRAFT" as any);
		expect(r["allowed"])["toBe"](false);
	});

	it("project manager cannot void invoices", () => {
		const r = canPerformInvoiceAction(PM, "void", "DRAFT" as any);
		expect(r["allowed"])["toBe"](false);
	});

	it("accountant can approve but not void", () => {
		expect(canPerformInvoiceAction(ACCOUNTANT, "approve", "PENDING_REVIEW" as any)["allowed"])["toBe"](true);
		expect(canPerformInvoiceAction(ACCOUNTANT, "void", "DRAFT" as any)["allowed"])["toBe"](false);
	});

	it("cannot edit a paid or voided invoice", () => {
		expect(canPerformInvoiceAction(OWNER, "edit", "PAID" as any)["allowed"])["toBe"](false);
		expect(canPerformInvoiceAction(OWNER, "edit", "VOID" as any)["allowed"])["toBe"](false);
	});

	it("cannot void an already-void invoice", () => {
		const r = canPerformInvoiceAction(OWNER, "void", "VOID" as any);
		expect(r["allowed"])["toBe"](false);
	});

	it("can only delete DRAFT invoices", () => {
		expect(canPerformInvoiceAction(OWNER, "delete", "DRAFT" as any)["allowed"])["toBe"](true);
		expect(canPerformInvoiceAction(OWNER, "delete", "SENT" as any)["allowed"])["toBe"](false);
		expect(canPerformInvoiceAction(OWNER, "delete", "PAID" as any)["allowed"])["toBe"](false);
	});

	it("field worker cannot perform any invoice action", () => {
		for (const action of ["create", "edit", "send", "approve", "void", "delete"] as const) {
			expect(canPerformInvoiceAction(FIELD, action, "DRAFT" as any)["allowed"])["toBe"](false);
		}
	});
});

describe("normaliseInvoiceState", () => {
	it("normalises to uppercase", () => {
		expect(normaliseInvoiceState("draft"))["toBe"]("DRAFT");
		expect(normaliseInvoiceState("Void"))["toBe"]("VOID");
	});

	it("returns null for unknown states", () => {
		expect(normaliseInvoiceState("BOGUS"))["toBeNull"]();
		expect(normaliseInvoiceState(null))["toBeNull"]();
		expect(normaliseInvoiceState(undefined))["toBeNull"]();
	});
});

describe("canAccessProjectResource", () => {
	it("grants when org-level permission present", () => {
		const r = canAccessProjectResource(["invoices.view"], [], "invoices.view");
		expect(r["allowed"])["toBe"](true);
		expect(r["reason"])["toContain"]("organisation-level");
	});

	it("grants when project-level permission present (but not org)", () => {
		const r = canAccessProjectResource([], ["invoices.view"], "invoices.view");
		expect(r["allowed"])["toBe"](true);
	});

	it("denies when neither org nor project grants the permission", () => {
		const r = canAccessProjectResource([], [], "invoices.view");
		expect(r["allowed"])["toBe"](false);
	});
});

describe("TERMINAL_INVOICE_STATES", () => {
	it("contains PAID and VOID", () => {
		expect(TERMINAL_INVOICE_STATES)["toContain"]("PAID");
		expect(TERMINAL_INVOICE_STATES)["toContain"]("VOID");
	});
});
