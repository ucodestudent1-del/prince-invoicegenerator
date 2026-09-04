import { describe, expect, it } from "vitest";
import {
  CreateInvoiceSchema,
  CreateCustomerSchema,
  CreateEstimateSchema,
  CreateChangeOrderSchema,
  RecordPaymentSchema,
  formatZodError,
} from "@/lib/schemas";

describe("CreateInvoiceSchema (B4)", () => {
  const valid = {
    customerId: "cust_1",
    type: "STANDARD" as const,
    issueDate: "2026-01-01",
    taxRate: 8.875,
    discount: 0,
    retainageRate: 0,
    items: [{ description: "Hours", quantity: 1, unitPrice: 100 }],
  };

  it("accepts a well-formed invoice", () => {
    expect(CreateInvoiceSchema["safeParse"](valid)["success"])["toBe"](true);
  });

  it("rejects an invoice with no line items", () => {
    const result = CreateInvoiceSchema["safeParse"]({ ...valid, items: [] });
    expect(result["success"])["toBe"](false);
  });

  it("rejects an invoice with a negative unit price", () => {
    const result = CreateInvoiceSchema["safeParse"]({
      ...valid,
      items: [{ description: "Hours", quantity: 1, unitPrice: -5 }],
    });
    expect(result["success"])["toBe"](false);
  });

  it("rejects an invoice with Infinity in any numeric field", () => {
    const result = CreateInvoiceSchema["safeParse"]({
      ...valid,
      taxRate: Infinity,
    });
    expect(result["success"])["toBe"](false);
  });

  it("rejects an invoice with NaN in any numeric field", () => {
    const result = CreateInvoiceSchema["safeParse"]({
      ...valid,
      discount: NaN,
    });
    expect(result["success"])["toBe"](false);
  });
});

describe("CreateCustomerSchema (B4)", () => {
  it("accepts a customer with a name and an optional email", () => {
    expect(
      CreateCustomerSchema["safeParse"]({ name: "Acme", email: "a@b.co" })["success"]
    )["toBe"](true);
  });

  it("rejects a customer with no name", () => {
    expect(CreateCustomerSchema["safeParse"]({ name: "" })["success"])["toBe"](false);
  });

  it("rejects a customer with an invalid email", () => {
    expect(
      CreateCustomerSchema["safeParse"]({ name: "Acme", email: "not-an-email" })["success"]
    )["toBe"](false);
  });
});

describe("CreateEstimateSchema (B4)", () => {
  const valid = {
    customerId: "cust_1",
    issueDate: "2026-01-01",
    taxRate: 0,
    discount: 0,
    items: [{ description: "Hours", quantity: 1, unitPrice: 100 }],
  };

  it("accepts a well-formed estimate", () => {
    expect(CreateEstimateSchema["safeParse"](valid)["success"])["toBe"](true);
  });

  it("rejects an estimate with no line items", () => {
    expect(CreateEstimateSchema["safeParse"]({ ...valid, items: [] })["success"])["toBe"](false);
  });
});

describe("RecordPaymentSchema (B1, B4)", () => {
  it("accepts a finite positive amount", () => {
    expect(
      RecordPaymentSchema["safeParse"]({ invoiceId: "inv_1", amount: 12.5 })["success"]
    )["toBe"](true);
  });

  it("rejects Infinity (B1)", () => {
    expect(
      RecordPaymentSchema["safeParse"]({ invoiceId: "inv_1", amount: Infinity })["success"]
    )["toBe"](false);
  });

  it("rejects NaN", () => {
    expect(
      RecordPaymentSchema["safeParse"]({ invoiceId: "inv_1", amount: NaN })["success"]
    )["toBe"](false);
  });

  it("rejects a zero amount", () => {
    expect(
      RecordPaymentSchema["safeParse"]({ invoiceId: "inv_1", amount: 0 })["success"]
    )["toBe"](false);
  });

  it("rejects a negative amount", () => {
    expect(
      RecordPaymentSchema["safeParse"]({ invoiceId: "inv_1", amount: -1 })["success"]
    )["toBe"](false);
  });
});

describe("CreateChangeOrderSchema (B4)", () => {
  const valid = {
    title: "Deck extension",
    amount: 5000,
    originalTotal: 100000,
  };

  it("accepts a well-formed change order", () => {
    expect(CreateChangeOrderSchema["safeParse"](valid)["success"])["toBe"](true);
  });

  it("rejects a change order with no title", () => {
    expect(
      CreateChangeOrderSchema["safeParse"]({ ...valid, title: "" })["success"]
    )["toBe"](false);
  });

  it("rejects an Infinity amount", () => {
    expect(
      CreateChangeOrderSchema["safeParse"]({ ...valid, amount: Infinity })["success"]
    )["toBe"](false);
  });

  it("rejects a NaN amount", () => {
    expect(
      CreateChangeOrderSchema["safeParse"]({ ...valid, amount: NaN })["success"]
    )["toBe"](false);
  });

  it("rejects a negative amount", () => {
    expect(
      CreateChangeOrderSchema["safeParse"]({ ...valid, amount: -100 })["success"]
    )["toBe"](false);
  });
});

describe("formatZodError", () => {
  it("returns the first issue's message", () => {
    const result = CreateInvoiceSchema["safeParse"]({
      customerId: "",
      type: "STANDARD",
      issueDate: "2026-01-01",
      taxRate: 0,
      discount: 0,
      retainageRate: 0,
      items: [],
    });
    expect(result["success"])["toBe"](false);
    if (!result["success"]) {
      expect(formatZodError(result["error"]))["toMatch"]("Customer is required");
    }
  });
});
