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
  depositPaid: number;
  invoices: ProjectInvoiceInput[];
  payments: ProjectPaymentInput[];
  expenses: ProjectExpenseInput[];
  changeOrders: ProjectChangeOrderInput[];
  currency?: string;
}

export interface ProjectFinancials {
  originalContractValue: number;
  depositPaid: number;
  depositBalance: number;
  approvedChangeOrders: number;
  currentContractValue: number;
  totalInvoiced: number;
  totalCollected: number;
  totalPayments: number;
  outstandingBalance: number;
  projectCosts: number;
  grossProfit: number;
  grossMargin: number;
  currency: string;
}

/**
 * Which statuses are considered "live" invoicing activity (exclude DRAFT and
 * VOID / CANCELLED / WRITTEN_OFF from the totals).
 */
const ACTIVE_INVOICE_STATUSES = new Set(["DRAFT", "SENT", "VIEWED", "PARTIALLY_PAID", "PAID", "OVERDUE"]);

export function computeProjectFinancials(input: ProjectFinancialsInput): ProjectFinancials {
  const currency = input["currency"] ?? "USD";

  const originalContractValue = roundMoney(input["originalContractValue"]);
  const depositPaid = roundMoney(input["depositPaid"]);

  // Only APPROVED change orders modify the contract value.
  const approvedChangeOrders = sumMoney(
    input["changeOrders"]["filter"]((co) => co["status"] === "APPROVED")["map"]((co) => co["changeAmount"])
  );

  const currentContractValue = roundMoney(originalContractValue + approvedChangeOrders);

  // Invoices with non-zero totals, excluding void/cancelled/written-off.
  const activeInvoices = input["invoices"]["filter"](
    (inv) => ACTIVE_INVOICE_STATUSES["has"](inv["status"])
  );

  const totalInvoiced = sumMoney(activeInvoices["map"]((inv) => inv["total"]));
  const totalPayments = sumMoney(input["payments"]["map"]((p) => p["amount"]));
  const totalCollected = roundMoney(depositPaid + totalPayments);

  // Outstanding = invoiced - collected, clamped at 0 (deposits/payments can't create negative balance).
  const outstandingCents = Math["max"](0, toCents(totalInvoiced) - toCents(totalPayments));
  // Remaining contract balance: current contract - invoiced - collected
  // (but we report totalInvoiced - totalCollected as the primary "what is owed")
  const outstandingBalance = roundMoney(fromCents(outstandingCents));

  const projectCosts = sumMoney(input["expenses"]["map"]((e) => e["amount"]));

  // Gross profit = revenue (invoiced) - costs.
  // When no invoices exist yet, use the deposit received as revenue baseline.
  const revenue = totalInvoiced > 0 ? totalInvoiced : depositPaid;
  const grossProfit = roundMoney(revenue - projectCosts);

  // Gross margin as a percentage (0–100).
  const grossMargin = revenue > 0 ? roundMoney((grossProfit / revenue) * 100) : 0;

  // Deposit balance: how much of the required deposit is still outstanding.
  // For now, depositBalance is the contract value minus deposit paid.
  const depositBalance = roundMoney(currentContractValue - depositPaid);

  return {
    originalContractValue,
    depositPaid,
    depositBalance,
    approvedChangeOrders,
    currentContractValue,
    totalInvoiced,
    totalCollected,
    totalPayments,
    outstandingBalance,
    projectCosts,
    grossProfit,
    grossMargin,
    currency,
  };
}

/**
 * Compute the remaining work value: contract value minus invoiced amount.
 * Positive means there is still billing capacity; negative means overbilled.
 */
export function computeRemainingWorkValue(contractValue: number, totalInvoiced: number): number {
  return roundMoney(contractValue - totalInvoiced);
}

/**
 * Compute project progress as a percentage (0–100) based on how much of the
 * contract value has been invoiced.
 */
export function computeProgressPercent(contractValue: number, totalInvoiced: number): number {
  if (contractValue <= 0) return 0;
  const progress = Math["min"](100, Math["max"](0, (totalInvoiced / contractValue) * 100));
  return roundMoney(progress);
}

/**
 * Determine if a project's status should be derived from dates vs. stored.
 * Returns the effective status string.
 */
export function deriveProjectStatus(storedStatus: string, endDate: Date | null | undefined, estCompletionDate: Date | null | undefined): string {
  if (storedStatus === "CANCELLED") return "CANCELLED";
  const today = new Date();
  const endDateD = endDate ? new Date(endDate) : null;
  const estCompletionD = estCompletionDate ? new Date(estCompletionDate) : null;

  if (storedStatus === "ON_HOLD") return "ON_HOLD";

  if (endDateD && endDateD < today) return "COMPLETED";
  if (storedStatus === "COMPLETED") return "COMPLETED";

  return "ACTIVE";
}
