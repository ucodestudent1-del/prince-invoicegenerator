import { coerceEnum } from "../src/lib/utils";
import { describe, it, expect } from "vitest";
import { PaymentMethod, CustomerStatus, CatalogUnit } from "@prisma/client";

enum Sample {
  A = "A",
  B = "B",
}

describe("coerceEnum", () => {
  it("passes valid enum values through", () => {
    expect(coerceEnum(Sample.A, Sample, "x")).toBe(Sample.A);
    expect(coerceEnum("B", Sample, "x")).toBe("B");
  });

  it("throws on invalid/empty values so the DB layer never sees an unchecked enum (root cause of issue 2/3/4/5)", () => {
    expect(() => coerceEnum("C", Sample, "x")).toThrow(/Invalid value for "x"/);
    expect(() => coerceEnum(undefined, Sample, "x")).toThrow();
    expect(() => coerceEnum(null, Sample, "x")).toThrow();
    expect(() => coerceEnum("", Sample, "x")).toThrow();
  });

  it("rejects invalid PaymentMethod values", () => {
    expect(() => coerceEnum("BOGUS", PaymentMethod, "method")).toThrow(/Invalid value for "method"/);
  });

  it("rejects invalid CustomerStatus values", () => {
    expect(() => coerceEnum("BOGUS", CustomerStatus, "status")).toThrow(/Invalid value for "status"/);
  });

  it("rejects invalid CatalogUnit values", () => {
    expect(() => coerceEnum("BOGUS", CatalogUnit, "unit")).toThrow(/Invalid value for "unit"/);
  });
});
