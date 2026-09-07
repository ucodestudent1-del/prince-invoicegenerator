import { describe, it, expect } from "vitest";
import { getInvoiceTemplate, getAvailableInvoiceTypes, INVOICE_TEMPLATES } from "@/lib/invoice-templates";
import type { InvoiceType } from "@prisma/client";

describe("invoice-templates", () => {
  it("returns a config for every InvoiceType enum value", () => {
    const types: InvoiceType[] = [
      "STANDARD",
      "FIXED_PRICE",
      "TIME_AND_MATERIALS",
      "PROGRESS",
      "MILESTONE",
      "CHANGE_ORDER",
      "DEPOSIT",
      "RETAINAGE",
      "FINAL",
      "RECURRING",
      "EXPENSE",
      "CUSTOM",
    ];
    for (const type of types) {
      const config = getInvoiceTemplate(type);
      expect(config.id).toBe(type);
      expect(config.label).toBeTruthy();
      expect(config.description).toBeTruthy();
      expect(config.sections).toBeDefined();
      expect(config.defaults).toBeDefined();
      expect(config.features).toBeDefined();
      expect(config.suggestions).toBeDefined();
    }
  });

  it("falls back to STANDARD for unknown types", () => {
    const config = getInvoiceTemplate("UNKNOWN" as InvoiceType);
    expect(config.id).toBe("STANDARD");
  });

  it("returns the correct available types based on feature flags", () => {
    const base = getAvailableInvoiceTypes(false, false, false);
    expect(base).toContain("STANDARD");
    expect(base).toContain("FIXED_PRICE");
    expect(base).toContain("TIME_AND_MATERIALS");
    expect(base).toContain("DEPOSIT");
    expect(base).toContain("FINAL");
    expect(base).toContain("CUSTOM");
    expect(base).toContain("EXPENSE");
    expect(base).not.toContain("PROGRESS");
    expect(base).not.toContain("MILESTONE");
    expect(base).not.toContain("RETAINAGE");
    expect(base).not.toContain("RECURRING");

    const withProgress = getAvailableInvoiceTypes(true, false, false);
    expect(withProgress).toContain("PROGRESS");
    expect(withProgress).toContain("MILESTONE");

    const withRetainage = getAvailableInvoiceTypes(false, false, true);
    expect(withRetainage).toContain("RETAINAGE");

    const withRecurring = getAvailableInvoiceTypes(false, true, false);
    expect(withRecurring).toContain("RECURRING");
  });

  it("has sensible defaults for each template", () => {
    for (const [key, config] of Object.entries(INVOICE_TEMPLATES)) {
      expect(config.defaults.taxRate).toBeGreaterThanOrEqual(0);
      expect(config.defaults.discount).toBeGreaterThanOrEqual(0);
      expect(config.defaults.retainageRate).toBeGreaterThanOrEqual(0);
      expect(["DEPOSIT", "PROGRESS", "FINAL", "CUSTOM", null]).toContain(config.defaults.billingIntent);
    }
  });

  it("disables retainage for templates that do not support it", () => {
    const standard = getInvoiceTemplate("STANDARD");
    expect(standard.features.supportsRetainage).toBe(false);
    expect(standard.sections.retainage).toBe(false);

    const fixedPrice = getInvoiceTemplate("FIXED_PRICE");
    expect(fixedPrice.features.supportsRetainage).toBe(true);
    expect(fixedPrice.sections.retainage).toBe(true);
  });

  it("requires project for project-bound templates", () => {
    const standard = getInvoiceTemplate("STANDARD");
    expect(standard.features.requiresProject).toBe(false);

    const progress = getInvoiceTemplate("PROGRESS");
    expect(progress.features.requiresProject).toBe(true);
  });
});
