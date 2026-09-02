import { describe, expect, it, each } from "vitest";
import {
	canTransition,
	isTerminalStatus,
	isActiveStatus,
	affectsContractValue,
	isEstimateAccepted,
	participatesInReceivables,
	ESTIMATE_STATUSES,
	CHANGE_ORDER_STATUSES,
	INVOICE_STATUSES,
} from "@/lib/document-workflow";

describe("status sets are distinct per document type", () => {
	it("estimates use proposal statuses (no PAID/OVERDUE)", () => {
		expect(ESTIMATE_STATUSES)["toEqual"](["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED", "CONVERTED"]);
		expect(ESTIMATE_STATUSES)["not"]["toContain"]("PAID");
		expect(ESTIMATE_STATUSES)["not"]["toContain"]("OVERDUE");
		expect(ESTIMATE_STATUSES)["not"]["toContain"]("PARTIALLY_PAID");
	});

	it("change orders use approval statuses (no PAID/SENT)", () => {
		expect(CHANGE_ORDER_STATUSES)["toEqual"](["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED", "VOID"]);
		expect(CHANGE_ORDER_STATUSES)["not"]["toContain"]("PAID");
		expect(CHANGE_ORDER_STATUSES)["not"]["toContain"]("SENT");
		expect(CHANGE_ORDER_STATUSES)["not"]["toContain"]("PARTIALLY_PAID");
	});

	it("invoices use billing/receivable statuses (no PENDING_APPROVAL)", () => {
		expect(INVOICE_STATUSES)["toEqual"](["DRAFT", "SENT", "VIEWED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID", "CANCELLED", "WRITTEN_OFF"]);
		expect(INVOICE_STATUSES)["not"]["toContain"]("PENDING_APPROVAL");
		expect(INVOICE_STATUSES)["not"]["toContain"]("APPROVED");
	});
});

describe("estimate workflow — no receivable on accept", () => {
	it("DRAFT → SENT is allowed and creates no receivable", () => {
		const r = canTransition("estimate", "DRAFT", "send");
		expect(r["allowed"])["toBe"](true);
		expect(r["sideEffect"])["toBe"]("none");
	});

	it("SENT → VIEWED", () => {
		expect(canTransition("estimate", "SENT", "view")["allowed"])["toBe"](true);
	});

	it("SENT → ACCEPTED is allowed and does NOT create a receivable", () => {
		const r = canTransition("estimate", "SENT", "accept");
		expect(r["allowed"])["toBe"](true);
		expect(r["sideEffect"])["toBe"]("none");
	});

	it("ACCEPTED → CONVERTED", () => {
		expect(canTransition("estimate", "ACCEPTED", "convert")["allowed"])["toBe"](true);
	});

	it("SENT cannot be accepted if already ACCEPTED (no double-accept)", () => {
		expect(canTransition("estimate", "ACCEPTED", "accept")["allowed"])["toBe"](false);
	});

	it("DRAFT cannot be accepted (must send first)", () => {
		expect(canTransition("estimate", "DRAFT", "accept")["allowed"])["toBe"](false);
	});

	it("DRAFT → CANCELLED", () => {
		expect(canTransition("estimate", "DRAFT", "cancel")["allowed"])["toBe"](true);
	});

	it("EXPIRED cannot be sent again", () => {
		expect(canTransition("estimate", "EXPIRED", "send")["allowed"])["toBe"](false);
	});
});

describe("change order workflow — approval only modifies contract scope", () => {
	it("DRAFT → PENDING_APPROVAL", () => {
		const r = canTransition("change_order", "DRAFT", "submit");
		expect(r["allowed"])["toBe"](true);
		expect(r["sideEffect"])["toBe"]("none");
	});

	it("PENDING_APPROVAL → APPROVED modifies contract scope, NOT a receivable", () => {
		const r = canTransition("change_order", "PENDING_APPROVAL", "approve");
		expect(r["allowed"])["toBe"](true);
		expect(r["sideEffect"])["toBe"]("modify_contract_scope");
	});

	it("DRAFT → APPROVED directly (bypass not blocked, but side-effect same)", () => {
		const r = canTransition("change_order", "DRAFT", "approve");
		expect(r["allowed"])["toBe"](true);
		expect(r["sideEffect"])["toBe"]("modify_contract_scope");
	});

	it("PENDING_APPROVAL → REJECTED", () => {
		expect(canTransition("change_order", "PENDING_APPROVAL", "reject")["allowed"])["toBe"](true);
	});

	it("APPROVED cannot be re-approved", () => {
		expect(canTransition("change_order", "APPROVED", "approve")["allowed"])["toBe"](false);
	});

	it("DRAFT → CANCELLED (pre-approval)", () => {
		expect(canTransition("change_order", "DRAFT", "cancel")["allowed"])["toBe"](true);
	});

	it("PENDING_APPROVAL → CANCELLED", () => {
		expect(canTransition("change_order", "PENDING_APPROVAL", "cancel")["allowed"])["toBe"](true);
	});

	it("APPROVED → VOID", () => {
		expect(canTransition("change_order", "APPROVED", "void")["allowed"])["toBe"](true);
	});

	it("REJECTED cannot be approved", () => {
		expect(canTransition("change_order", "REJECTED", "approve")["allowed"])["toBe"](false);
	});
});

describe("invoice workflow — only invoices create receivables", () => {
	it("DRAFT → SENT creates a receivable", () => {
		const r = canTransition("invoice", "DRAFT", "send");
		expect(r["allowed"])["toBe"](true);
		expect(r["sideEffect"])["toBe"]("create_receivable");
	});

	it("SENT → PARTIALLY_PAID on partial payment", () => {
		const r = canTransition("invoice", "SENT", "record_payment");
		expect(r["allowed"])["toBe"](true);
		expect(r["sideEffect"])["toBe"]("none");
	});

	it("SENT → PAID on full payment", () => {
		expect(canTransition("invoice", "SENT", "full_payment")["allowed"])["toBe"](true);
	});

	it("PARTIALLY_PAID → PAID on final payment", () => {
		expect(canTransition("invoice", "PARTIALLY_PAID", "full_payment")["allowed"])["toBe"](true);
	});

	it("PAID cannot record more payments (already terminal)", () => {
		expect(canTransition("invoice", "PAID", "record_payment")["allowed"])["toBe"](false);
	});

	it("SENT → VOID", () => {
		const r = canTransition("invoice", "SENT", "void");
		expect(r["allowed"])["toBe"](true);
		expect(r["sideEffect"])["toBe"]("create_receivable");
	});

	it("DRAFT → CANCELLED", () => {
		expect(canTransition("invoice", "DRAFT", "cancel")["allowed"])["toBe"](true);
	});

	it("SENT → DRAFT (revert before paid)", () => {
		expect(canTransition("invoice", "SENT", "revert_to_draft")["allowed"])["toBe"](true);
	});
});

describe("terminal / active / contract-value semantics", () => {
	it("terminal statuses per type", () => {
		expect(isTerminalStatus("invoice", "PAID"))["toBe"](true);
		expect(isTerminalStatus("invoice", "WRITTEN_OFF"))["toBe"](true);
		expect(isTerminalStatus("invoice", "CANCELLED"))["toBe"](true);
		expect(isTerminalStatus("estimate", "ACCEPTED"))["toBe"](true);
		expect(isTerminalStatus("change_order", "APPROVED"))["toBe"](true);
	});

	it("active statuses exclude terminal", () => {
		expect(isActiveStatus("invoice", "SENT"))["toBe"](true);
		expect(isActiveStatus("invoice", "PAID"))["toBe"](false);
		expect(isActiveStatus("estimate", "DRAFT"))["toBe"](true);
		expect(isActiveStatus("estimate", "ACCEPTED"))["toBe"](false);
		expect(isActiveStatus("change_order", "PENDING_APPROVAL"))["toBe"](true);
		expect(isActiveStatus("change_order", "APPROVED"))["toBe"](false);
	});

	it("only APPROVED change orders affect contract value", () => {
		expect(affectsContractValue("APPROVED"))["toBe"](true);
		expect(affectsContractValue("PENDING_APPROVAL"))["toBe"](false);
		expect(affectsContractValue("DRAFT"))["toBe"](false);
		expect(affectsContractValue("REJECTED"))["toBe"](false);
		expect(affectsContractValue("CANCELLED"))["toBe"](false);
	});

	it("estimate acceptance does not imply receivables", () => {
		expect(isEstimateAccepted("ACCEPTED"))["toBe"](true);
		expect(isEstimateAccepted("SENT"))["toBe"](false);
	});

	it("only invoices participate in receivables", () => {
		expect(participatesInReceivables("invoice"))["toBe"](true);
		expect(participatesInReceivables("estimate"))["toBe"](false);
		expect(participatesInReceivables("change_order"))["toBe"](false);
	});
});

describe("cross-type isolation", () => {
	it("invoice actions are rejected for estimates", () => {
		expect(canTransition("estimate", "DRAFT", "send")["allowed"])["toBe"](true);
		expect(canTransition("estimate", "DRAFT", "record_payment")["allowed"])["toBe"](false);
	});

	it("change-order actions are rejected for invoices", () => {
		expect(canTransition("invoice", "DRAFT", "submit")["allowed"])["toBe"](false);
		expect(canTransition("change_order", "PENDING_APPROVAL", "send")["allowed"])["toBe"](false);
	});

	it("estimate-only actions are rejected for change orders", () => {
		expect(canTransition("change_order", "ACCEPTED", "convert")["allowed"])["toBe"](false);
	});
});
