/**
 * Project hub tests.
 *
 * Covers:
 *   1. computeProjectFinancials returns the full Phase 1 field set including
 *      estimatedCost, actualCosts, projectedCosts, projectedProfit,
 *      invoicedPercent, collectedPercent, remainingBillable.
 *   2. Approved change orders roll up into the current contract value.
 *   3. Overbilled projects (totalInvoiced > currentContractValue) report a
 *      negative remainingBillable and a >100% invoicedPercent.
 *   4. Project status badge covers all 11 statuses.
 *   5. coerceProjectType accepts only valid ProjectType values.
 */

import { describe, it, expect } from "vitest";
import {
  computeProjectFinancials,
  computeProgressPercent,
  computeRemainingWorkValue,
} from "@/lib/project-financials";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_VARIANT,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_GROUP,
} from "@/lib/project-status";
import { coerceProjectType, isProjectType, DEFAULT_PROJECT_TYPE } from "@/lib/project-types";

describe("computeProjectFinancials — Phase 1 fields", () => {
  it("returns all derived fields including estimated vs projected", () => {
    const f = computeProjectFinancials({
      originalContractValue: 85000,
      estimatedCost: 42000,
      depositPaid: 5000,
      invoices: [
        { total: 47500, amountPaid: 40000, status: "PARTIALLY_PAID" },
      ],
      payments: [{ amount: 35000 }],
      expenses: [{ amount: 31200 }],
      changeOrders: [
        { changeAmount: 7500, status: "APPROVED" },
        { changeAmount: 1500, status: "PENDING_APPROVAL" },
      ],
    });

    expect(f.originalContractValue).toBe(85000);
    expect(f.estimatedCost).toBe(42000);
    expect(f.approvedChangeOrders).toBe(7500);
    expect(f.currentContractValue).toBe(92500);
    expect(f.totalInvoiced).toBe(47500);
    expect(f.totalCollected).toBe(40000); // 5000 deposit + 35000 payments
    expect(f.outstandingBalance).toBe(12500); // 47500 - 35000 (payments only)
    expect(f.actualCosts).toBe(31200);
    expect(f.remainingEstimatedCosts).toBe(10800); // 42000 - 31200
    expect(f.projectedCosts).toBe(42000);
    expect(f.estimatedProfit).toBe(50500); // 92500 - 42000
    expect(f.projectedProfit).toBe(50500); // 92500 - 42000
    expect(f.invoicedPercent).toBeCloseTo(51.35, 1);
    expect(f.collectedPercent).toBeCloseTo(43.24, 1);
    expect(f.remainingBillable).toBe(45000);
    expect(f.currency).toBe("USD");
  });

  it("rolls up multiple approved change orders correctly", () => {
    const f = computeProjectFinancials({
      originalContractValue: 100000,
      depositPaid: 0,
      invoices: [],
      payments: [],
      expenses: [],
      changeOrders: [
        { changeAmount: 5000, status: "APPROVED" },
        { changeAmount: 2500, status: "APPROVED" },
        { changeAmount: 10000, status: "PENDING_APPROVAL" },
      ],
    });
    expect(f.approvedChangeOrders).toBe(7500);
    expect(f.currentContractValue).toBe(107500);
  });

  it("handles overbilled projects (negative remaining billable)", () => {
    const f = computeProjectFinancials({
      originalContractValue: 100000,
      depositPaid: 0,
      invoices: [
        { total: 60000, amountPaid: 0, status: "SENT" },
        { total: 50000, amountPaid: 0, status: "SENT" },
      ],
      payments: [],
      expenses: [],
      changeOrders: [],
    });
    expect(f.totalInvoiced).toBe(110000);
    expect(f.remainingBillable).toBe(-10000);
    // The percent is clamped at 100 to keep the progress bar sane; the
    // sign of `remainingBillable` is the real signal for overbilling.
    expect(f.invoicedPercent).toBe(100);
  });

  it("ignores void / cancelled / written-off invoices", () => {
    const f = computeProjectFinancials({
      originalContractValue: 50000,
      depositPaid: 0,
      invoices: [
        { total: 10000, amountPaid: 0, status: "VOID" },
        { total: 8000, amountPaid: 0, status: "CANCELLED" },
        { total: 5000, amountPaid: 0, status: "WRITTEN_OFF" },
        { total: 7000, amountPaid: 0, status: "SENT" },
      ],
      payments: [],
      expenses: [],
      changeOrders: [],
    });
    expect(f.totalInvoiced).toBe(7000);
  });

  it("uses deposit as revenue baseline when no invoices exist", () => {
    const f = computeProjectFinancials({
      originalContractValue: 50000,
      depositPaid: 10000,
      invoices: [],
      payments: [],
      expenses: [{ amount: 2000 }],
      changeOrders: [],
    });
    expect(f.grossProfit).toBe(8000); // 10000 - 2000
    expect(f.grossMargin).toBe(80);
  });

  it("returns zero invoiced/collected percent when no contract value", () => {
    const f = computeProjectFinancials({
      originalContractValue: 0,
      depositPaid: 0,
      invoices: [],
      payments: [],
      expenses: [],
      changeOrders: [],
    });
    expect(f.invoicedPercent).toBe(0);
    expect(f.collectedPercent).toBe(0);
  });
});

describe("computeProgressPercent / computeRemainingWorkValue", () => {
  it("clamps progress to 0-100", () => {
    expect(computeProgressPercent(0, 0)).toBe(0);
    expect(computeProgressPercent(100, 50)).toBe(50);
    expect(computeProgressPercent(100, 150)).toBe(100);
    expect(computeProgressPercent(100, -10)).toBe(0);
  });
  it("returns negative remaining when overbilled", () => {
    expect(computeRemainingWorkValue(1000, 1200)).toBe(-200);
  });
});

describe("PROJECT_STATUSES", () => {
  it("includes all 11 phase-1 statuses", () => {
    expect(PROJECT_STATUSES).toContain("DRAFT");
    expect(PROJECT_STATUSES).toContain("ESTIMATE");
    expect(PROJECT_STATUSES).toContain("PENDING_APPROVAL");
    expect(PROJECT_STATUSES).toContain("APPROVED");
    expect(PROJECT_STATUSES).toContain("SCHEDULED");
    expect(PROJECT_STATUSES).toContain("IN_PROGRESS");
    expect(PROJECT_STATUSES).toContain("ACTIVE");
    expect(PROJECT_STATUSES).toContain("ON_HOLD");
    expect(PROJECT_STATUSES).toContain("COMPLETED");
    expect(PROJECT_STATUSES).toContain("CLOSED");
    expect(PROJECT_STATUSES).toContain("CANCELLED");
  });

  it("has a variant and label for every status", () => {
    for (const s of PROJECT_STATUSES) {
      expect(PROJECT_STATUS_VARIANT[s]).toBeDefined();
      expect(PROJECT_STATUS_LABEL[s]).toBeTruthy();
    }
  });

  it("groups statuses by lifecycle phase", () => {
    expect(PROJECT_STATUS_GROUP["DRAFT"]).toBe("planning");
    expect(PROJECT_STATUS_GROUP["IN_PROGRESS"]).toBe("active");
    expect(PROJECT_STATUS_GROUP["COMPLETED"]).toBe("done");
    expect(PROJECT_STATUS_GROUP["CANCELLED"]).toBe("done");
  });
});

describe("project-types", () => {
  it("coerceProjectType falls back to GENERAL_CONTRACTING", () => {
    expect(coerceProjectType("not-a-type")).toBe(DEFAULT_PROJECT_TYPE);
    expect(coerceProjectType(undefined)).toBe(DEFAULT_PROJECT_TYPE);
    expect(coerceProjectType("ROOFING")).toBe("ROOFING");
  });

  it("isProjectType narrows correctly", () => {
    expect(isProjectType("HVAC")).toBe(true);
    expect(isProjectType("NOPE")).toBe(false);
  });
});
