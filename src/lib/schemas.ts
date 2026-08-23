import { z } from "zod";

export const CreateInvoiceSchema = z["object"]({
  customerId: z["string"]()["min"](1, "Customer is required"),
  projectId: z["string"]()["optional"](),
  type: z["enum"](["STANDARD", "PROGRESS", "RECURRING"]),
  issueDate: z["string"]()["min"](1, "Issue date is required"),
  dueDate: z["string"]()["optional"](),
  currency: z["string"]()["default"]("USD"),
  taxRate: z["number"]()["min"](0)["max"](100),
  discount: z["number"]()["min"](0),
  retainageRate: z["number"]()["min"](0)["max"](100),
  notes: z["string"]()["optional"](),
  invoiceNumber: z["string"]()["optional"](),
  logoUrl: z["string"]()["optional"](),
  billToAddress: z["string"]()["optional"](),
  shipToAddress: z["string"]()["optional"](),
  items: z
    ["array"](
      z["object"]({
        description: z["string"]()["min"](1, "Description is required"),
        quantity: z["number"]()["positive"]("Quantity must be positive"),
        unitPrice: z["number"]()["min"](0, "Unit price cannot be negative"),
      })
    )
    ["min"](1, "At least one item is required"),
  scheduledFor: z["string"]()["optional"](),
});

export const CreateCustomerSchema = z["object"]({
  name: z["string"]()["min"](1, "Name is required"),
  company: z["string"]()["optional"](),
  email: z["string"]()["email"]()["optional"](),
  phone: z["string"]()["optional"](),
  address: z["string"]()["optional"](),
  notes: z["string"]()["optional"](),
});

export const CreateEstimateSchema = z["object"]({
  customerId: z["string"]()["min"](1, "Customer is required"),
  projectId: z["string"]()["optional"](),
  issueDate: z["string"]()["min"](1, "Issue date is required"),
  validUntil: z["string"]()["optional"](),
  currency: z["string"]()["default"]("USD"),
  taxRate: z["number"]()["min"](0)["max"](100),
  discount: z["number"]()["min"](0),
  notes: z["string"]()["optional"](),
  items: z
    ["array"](
      z["object"]({
        description: z["string"]()["min"](1),
        quantity: z["number"]()["positive"](),
        unitPrice: z["number"]()["min"](0),
      })
    )
    ["min"](1, "At least one item is required"),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type CreateEstimateInput = z.infer<typeof CreateEstimateSchema>;
