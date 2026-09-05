/**
 * Project financial calculations.
 *
 * A Project is a construction job container. Its financial picture is derived
 * from three sources:
 *   1. Invoices billed against the project (sum of invoice.total, filtered to
 *      non-draft statuses).
 *   2. Payments received against those invoices (sum of payment.amount).
 *   3. Expenses incurred on the project (sum of expense.amount).
 *   4. Change orders that modify the contract scope (only APPROVED change orders
 *      increase the current contract value; see document-workflow.ts).
 *
 * The Project model carries `contractValue` (original signed contract) and
 * `depositPaid` (any upfront deposit already received). Everything else is
 * rolled up from child records.
 */

import { sumMoney, fromCents, toCents, roundMoney } from "@/lib/money";

export interface ProjectInvoiceInput {
  total: number;
  amountPaid: number;
  status: string;
  currency?: string;
}

export interface ProjectPaymentInput {
  amount: number;
}

export interface ProjectExpenseInput {
  amount: number;
}

export interface ProjectChangeOrderInput {
  changeAmount: number;
  status: string;
}

export interface ProjectFinancialsInput {
  originalContractValue: number;
  estimatedCost?: number;
  depositPaid: number;
  invoices: ProjectInvoiceInput[];
  payments: ProjectPaymentInput[];
  expenses: ProjectExpenseInput[];
  changeOrders: ProjectChangeOrderInput[];
  currency?: string;
}

export interface ProjectFinancials {
  originalContractValue: number;
  estimatedCost: number;
  depositPaid: number;
  depositBalance: number;
  approvedChangeOrders: number;
  currentContractValue: number;
  totalInvoiced: number;
  totalCollected: number;
  totalPayments: number;
  outstandingBalance: number;
  projectCosts: number;
  actualCosts: number;
  projectedCosts: number;
  remainingEstimatedCosts: number;
  grossProfit: number;
  estimatedProfit: number;
  estimatedMargin: number;
  projectedProfit: number;
  projectedMargin: number;
  grossMargin: number;
  invoicedPercent: number;
  collectedPercent: number;
  remainingBillable: number;
  currency: string;
}

/**
 * Which statuses are considered "live" invoicing activity (exclude VOID /
 * CANCELLED / WRITTEN_OFF from the totals).
 */
const ACTIVE_INVOICE_STATUSES = new Set([
  "DRAFT",
  "SENT",
  "VIEWED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
]);

export function computeProjectFinancials(input: ProjectFinancialsInput): ProjectFinancials {
  const currency = input["currency"] ?? "USD";

  const originalContractValue = roundMoney(input["originalContractValue"]);
  const estimatedCost = roundMoney(input["estimatedCost"] ?? 0);
  const depositPaid = roundMoney(input["depositPaid"]);

  // Only APPROVED change orders modify the contract value.
  const approvedChangeOrders = sumMoney(
    input["changeOrders"]
      ["filter"]((co) => co["status"] === "APPROVED")
      ["map"]((co) => co["changeAmount"]),
  );

  const currentContractValue = roundMoney(originalContractValue + approvedChangeOrders);

  // Invoices with non-zero totals, excluding void/cancelled/written-off.
  const activeInvoices = input["invoices"]["filter"]((inv) =>
    ACTIVE_INVOICE_STATUSES["has"](inv["status"]),
  );

  const totalInvoiced = sumMoney(activeInvoices["map"]((inv) => inv["total"]));
  const totalPayments = sumMoney(input["payments"]["map"]((p) => p["amount"]));
  const totalCollected = roundMoney(depositPaid + totalPayments);

  // Outstanding = invoiced - collected, clamped at 0 (deposits/payments can't
  // create negative balance).
  const outstandingCents = Math["max"](
    0,
    toCents(totalInvoiced) - toCents(totalPayments),
  );
  const outstandingBalance = roundMoney(fromCents(outstandingCents));

  // Remaining billable capacity: current contract value - already invoiced.
  // Negative means the project is overbilled.
  const remainingBillable = roundMoney(currentContractValue - totalInvoiced);

  // Actual costs: everything that has been recorded as an expense so far.
  const actualCosts = sumMoney(input["expenses"]["map"]((e) => e["amount"]));
  const projectCosts = actualCosts;

  // Remaining estimated costs: estimated cost baseline - actual costs.
  // Clamped at 0 so the projected total never undercuts actuals.
  const remainingEstimatedCents = Math["max"](
    0,
    toCents(estimatedCost) - toCents(actualCosts),
  );
  const remainingEstimatedCosts = roundMoney(fromCents(remainingEstimatedCents));
  const projectedCosts = roundMoney(actualCosts + remainingEstimatedCosts);

  // Revenue baseline: invoiced (if any), otherwise the deposit received.
  const revenue = totalInvoiced > 0 ? totalInvoiced : depositPaid;

  // Actual gross profit uses revenue (collected) minus actual costs.
  const grossProfit = roundMoney(revenue - actualCosts);
  // Estimated profit (at job start): contract - estimated cost.
  const estimatedProfit = roundMoney(currentContractValue - estimatedCost);
  // Projected profit (best estimate of final profit): contract - projected costs.
  const projectedProfit = roundMoney(currentContractValue - projectedCosts);

  // Margins.
  const grossMargin = revenue > 0 ? roundMoney((grossProfit / revenue) * 100) : 0;
  const estimatedMargin =
    estimatedCost > 0 ? roundMoney((estimatedProfit / currentContractValue) * 100) : 0;
  const projectedMargin =
    currentContractValue > 0 ? roundMoney((projectedProfit / currentContractValue) * 100) : 0;

  // Billing progress: how much of the current contract has been invoiced and
  // how much has been collected. Kept separate because they tell different
  // stories (billed ≠ paid).
  const invoicedPercent =
    currentContractValue > 0
      ? roundMoney(Math["min"](100, (totalInvoiced / currentContractValue) * 100))
      : 0;
  const collectedPercent =
    currentContractValue > 0
      ? roundMoney(Math["min"](100, (totalCollected / currentContractValue) * 100))
      : 0;

  // Deposit balance: how much of the required deposit is still outstanding.
  const depositBalance = roundMoney(currentContractValue - depositPaid);

  return {
    originalContractValue,
    estimatedCost,
    depositPaid,
    depositBalance,
    approvedChangeOrders,
    currentContractValue,
    totalInvoiced,
    totalCollected,
    totalPayments,
    outstandingBalance,
    projectCosts,
    actualCosts,
    projectedCosts,
    remainingEstimatedCosts,
    grossProfit,
    estimatedProfit,
    estimatedMargin,
    projectedProfit,
    projectedMargin,
    grossMargin,
    invoicedPercent,
    collectedPercent,
    remainingBillable,
    currency,
  };
}

/**
 * Compute the remaining work value: contract value minus invoiced amount.
 * Positive means there is still billing capacity; negative means overbilled.
 */
export function computeRemainingWorkValue(
  contractValue: number,
  totalInvoiced: number,
): number {
  return roundMoney(contractValue - totalInvoiced);
}

/**
 * Compute project progress as a percentage (0–100) based on how much of the
 * contract value has been invoiced.
 */
export function computeProgressPercent(
  contractValue: number,
  totalInvoiced: number,
): number {
  if (contractValue <= 0) return 0;
  const progress = Math["min"](100, Math["max"](0, (totalInvoiced / contractValue) * 100));
  return roundMoney(progress);
}

/**
 * Determine if a project's status should be derived from dates vs. stored.
 * Returns the effective status string.
 */
export function deriveProjectStatus(
  storedStatus: string,
  endDate: Date | null | undefined,
  estCompletionDate: Date | null | undefined,
): string {
  if (storedStatus === "CANCELLED") return "CANCELLED";
  const today = new Date();
  const endDateD = endDate ? new Date(endDate) : null;
  const estCompletionD = estCompletionDate ? new Date(estCompletionDate) : null;

  if (storedStatus === "ON_HOLD") return "ON_HOLD";
  if (storedStatus === "CLOSED") return "CLOSED";
  if (storedStatus === "IN_PROGRESS") return "IN_PROGRESS";
  if (storedStatus === "PENDING_APPROVAL") return "PENDING_APPROVAL";
  if (storedStatus === "APPROVED") return "APPROVED";
  if (storedStatus === "DRAFT") return "DRAFT";
  if (storedStatus === "ESTIMATE") return "ESTIMATE";
  if (storedStatus === "SCHEDULED") return "SCHEDULED";

  if (endDateD && endDateD < today) return "COMPLETED";
  if (storedStatus === "COMPLETED") return "COMPLETED";

  return "ACTIVE";
}
