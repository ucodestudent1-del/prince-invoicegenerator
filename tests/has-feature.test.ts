import { hasFeature } from "../src/lib/plans";
import { describe, it, expect, vi } from "vitest";

describe("hasFeature (drives the PDF watermark gating)", () => {
  it("grants features included in each subscription tier", () => {
    expect(hasFeature("FREE", "savedAddresses")).toBe(true);
    expect(hasFeature("FREE", "branding")).toBe(true);
    expect(hasFeature("STARTER", "estimates")).toBe(true);
    expect(hasFeature("STARTER", "catalogItems")).toBe(true);
    expect(hasFeature("PRO", "changeOrders")).toBe(true);
    expect(hasFeature("PRO", "pdfExport")).toBe(true);
    expect(hasFeature("BUSINESS", "customFonts")).toBe(true);
    expect(hasFeature("BUSINESS", "multipleLayouts")).toBe(true);
  });

  it("denies features that are not part of a plan", () => {
    expect(hasFeature("FREE", "estimates")).toBe(false);
    expect(hasFeature("FREE", "changeOrders")).toBe(false);
    expect(hasFeature("STARTER", "changeOrders")).toBe(false);
    expect(hasFeature("STARTER", "pdfExport")).toBe(false);
    expect(hasFeature("PRO", "customFonts")).toBe(false);
  });

  it("respects the NEXT_PUBLIC_UNLOCK_ALL_FEATURES override", () => {
    vi.stubEnv("NEXT_PUBLIC_UNLOCK_ALL_FEATURES", "true");
    expect(hasFeature("FREE", "customFonts")).toBe(true);
    expect(hasFeature("FREE", "changeOrders")).toBe(true);
    vi.unstubAllEnvs();
    expect(hasFeature("FREE", "customFonts")).toBe(false);
  });
});
