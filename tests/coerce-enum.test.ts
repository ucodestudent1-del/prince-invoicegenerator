import { coerceEnum } from "../src/lib/utils";
import { describe, it, expect } from "vitest";

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
});
