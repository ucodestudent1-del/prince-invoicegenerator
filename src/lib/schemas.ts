import { z } from "zod";

/**
 * Tighter server-action schemas (Plan B4). The previous schemas accepted
 * `number` unbounded, which let NaN/Infinity reach `recordPayment` and let
 * negative line-item amounts reach `createInvoice`. The new ones enforce
 * finite, non-negative monetary values and a minimum of one item.
 */

const finiteNonNegative = z["number"]()["finite"]()["nonnegative"]();

export const CreateInvoiceSchema = z["object"]({
  customerId: z["string"]()["min"](1, "Customer is required"),
  projectId: z["string"]()["optional"]()["nullable"](),
  type: z["enum"](["STANDARD", "PROGRESS", "RECURRING"]),
  issueDate: z["string"]()["min"](1, "Issue date is required"),
  dueDate: z["string"]()["optional"]()["nullable"](),
  currency: z["string"]()["default"]("USD"),
  taxRate: z["number"]()["finite"]()["min"](0)["max"](100),
  discount: finiteNonNegative,
  retainageRate: z["number"]()["finite"]()["min"](0)["max"](100),
  notes: z["string"]()["optional"]()["nullable"](),
  invoiceNumber: z["string"]()["optional"]()["nullable"](),
  logoUrl: z["string"]()["optional"]()["nullable"](),
  billToAddress: z["string"]()["optional"]()["nullable"](),
  shipToAddress: z["string"]()["optional"]()["nullable"](),
  items: z
    ["array"](
      z["object"]({
        description: z["string"]()["min"](1, "Description is required"),
        quantity: z["number"]()["finite"]()["positive"]("Quantity must be positive"),
        unitPrice: z["number"]()["finite"]()["min"](0, "Unit price cannot be negative"),
        sku: z["string"]()["optional"]()["nullable"](),
      })
    )
    ["min"](1, "At least one item is required"),
});

export const CreateCustomerSchema = z["object"]({
  name: z["string"]()["min"](1, "Name is required"),
  company: z["string"]()["optional"]()["nullable"](),
  email: z["string"]()["email"]()["optional"]()["nullable"](),
  phone: z["string"]()["optional"]()["nullable"](),
  address: z["string"]()["optional"]()["nullable"](),
  notes: z["string"]()["optional"]()["nullable"](),
});

export const CreateEstimateSchema = z["object"]({
  customerId: z["string"]()["min"](1, "Customer is required"),
  projectId: z["string"]()["optional"]()["nullable"](),
  issueDate: z["string"]()["min"](1, "Issue date is required"),
  validUntil: z["string"]()["optional"]()["nullable"](),
  currency: z["string"]()["default"]("USD"),
  taxRate: z["number"]()["finite"]()["min"](0)["max"](100),
  discount: finiteNonNegative,
  notes: z["string"]()["optional"]()["nullable"](),
  title: z["string"]()["optional"]()["nullable"](),
  billToAddress: z["string"]()["optional"]()["nullable"](),
  termsAndConditions: z["string"]()["optional"]()["nullable"](),
  items: z
    ["array"](
      z["object"]({
        description: z["string"]()["min"](1),
        quantity: z["number"]()["finite"]()["positive"](),
        unitPrice: z["number"]()["finite"]()["min"](0),
        unit: z["string"]()["default"]("units"),
        sku: z["string"]()["optional"]()["nullable"](),
      })
    )
    ["min"](1, "At least one item is required"),
});

export const CreateChangeOrderSchema = z["object"]({
  title: z["string"]()["min"](1, "Title is required"),
  description: z["string"]()["optional"]()["nullable"](),
  projectId: z["string"]()["optional"]()["nullable"](),
  invoiceId: z["string"]()["optional"]()["nullable"](),
  customerId: z["string"]()["optional"]()["nullable"](),
  amount: z["number"]()["finite"]()["nonnegative"]("Amount must be a non-negative number"),
  originalTotal: z["number"]()["finite"]()["nonnegative"]()["optional"](),
  daysAdded: z["number"]()["finite"]()["nonnegative"]()["optional"]()["nullable"](),
  originalCompletionDate: z["string"]()["optional"]()["nullable"](),
  newCompletionDate: z["string"]()["optional"]()["nullable"](),
  billToAddress: z["string"]()["optional"]()["nullable"](),
  scopeChangeDescription: z["string"]()["optional"]()["nullable"](),
  scheduleImpactDescription: z["string"]()["optional"]()["nullable"](),
});

/**
 * Schema for `recordPayment`. Constrains amount to a finite positive number
 * (Plan B1) and normalises optional fields.
 */
export const RecordPaymentSchema = z["object"]({
  invoiceId: z["string"]()["min"](1, "Invoice is required"),
  amount: z["number"]()["finite"]()["positive"]("Payment amount must be a positive number"),
  method: z["string"]()["optional"](),
  note: z["string"]()["optional"]()["nullable"](),
  stripePaymentId: z["string"]()["optional"]()["nullable"](),
  paypalTransactionId: z["string"]()["optional"]()["nullable"](),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type CreateEstimateInput = z.infer<typeof CreateEstimateSchema>;
export type CreateChangeOrderInput = z.infer<typeof CreateChangeOrderSchema>;
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;

/** Format a Zod error into a single human-readable message. */
export function formatZodError(err: z.ZodError): string {
  const first = err["issues"]?.[0];
  if (!first) return "Invalid input.";
  return first["message"] || "Invalid input.";
}
