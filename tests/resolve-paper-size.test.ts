import { resolvePaperSize } from "../src/lib/pdf-constants";
import { describe, it, expect } from "vitest";

describe("resolvePaperSize", () => {
  it("returns Letter and Legal unchanged", () => {
    expect(resolvePaperSize("Legal")).toBe("Legal");
    expect(resolvePaperSize("Letter")).toBe("Letter");
  });

  it("returns A4 for any unrecognized or missing value", () => {
    expect(resolvePaperSize("A4")).toBe("A4");
    expect(resolvePaperSize("A5")).toBe("A4");
    expect(resolvePaperSize("bogus")).toBe("A4");
    expect(resolvePaperSize("")).toBe("A4");
    expect(resolvePaperSize(null)).toBe("A4");
    expect(resolvePaperSize(undefined)).toBe("A4");
  });
});
