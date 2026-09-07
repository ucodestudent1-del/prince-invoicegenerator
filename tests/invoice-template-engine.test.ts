import { describe, it, expect } from "vitest";
import {
  getDefaultTemplate,
  buildDefaultTemplate,
  getDefaultSections,
  DEFAULT_TEMPLATE_STYLING,
  ALL_SECTION_TYPES,
  createTemplateSection,
  reorderTemplateSections,
  removeTemplateSection,
} from "@/lib/invoice-template-config";
import { evaluateTemplate, evaluateRule, evaluateCondition, applyTemplateDefaults } from "@/lib/conditional-logic";
import type { InvoiceType } from "@prisma/client";

describe("invoice-template-config", () => {
  it("builds a template for every InvoiceType", () => {
    const types: InvoiceType[] = [
      "STANDARD",
      "PROGRESS",
      "RECURRING",
      "EXPENSE",
      "FIXED_PRICE",
      "TIME_AND_MATERIALS",
      "MILESTONE",
      "CHANGE_ORDER",
      "DEPOSIT",
      "RETAINAGE",
      "FINAL",
      "CUSTOM",
    ];

    for (const type of types) {
      const config = getDefaultTemplate(type);
      expect(config.id).toBeTruthy();
      expect(config.name).toBeTruthy();
      expect(config.invoiceType).toBe(type);
      expect(config.sections.length).toBeGreaterThan(0);
      expect(config.fields.length).toBeGreaterThan(0);
      expect(config.styling).toEqual(DEFAULT_TEMPLATE_STYLING);
      expect(config.rules).toEqual([]);
    }
  });

  it("getStandard template includes line_items and payment_summary sections", () => {
    const sections = getDefaultSections("STANDARD");
    expect(sections).toContain("business_info");
    expect(sections).toContain("customer_info");
    expect(sections).toContain("invoice_details");
    expect(sections).toContain("line_items");
    expect(sections).toContain("payment_summary");
    expect(sections).toContain("taxes");
    expect(sections).toContain("payment_terms");
    expect(sections).toContain("notes");
  });

  it("progress template includes retainage and schedule_of_values", () => {
    const sections = getDefaultSections("PROGRESS");
    expect(sections).toContain("retainage");
    expect(sections).toContain("schedule_of_values");
    expect(sections).toContain("change_orders");
    expect(sections).toContain("previous_payments");
  });

  it("time-and-materials template includes labor, materials, and equipment tables", () => {
    const sections = getDefaultSections("TIME_AND_MATERIALS");
    expect(sections).toContain("labor_table");
    expect(sections).toContain("materials_table");
    expect(sections).toContain("equipment_table");
  });

  it("buildDefaultTemplate returns correct structure", () => {
    const built = buildDefaultTemplate("STANDARD");
    expect(built.sections).toBeDefined();
    expect(built.fields).toBeDefined();
    expect(built.styling).toBeDefined();
    expect(built.rules).toEqual([]);

    const sectionIds = built.sections.map((s) => s.id);
    expect(sectionIds).toContain("section_business_info");
    expect(sectionIds).toContain("section_line_items");
  });

  it("all sections have required fields", () => {
    const config = getDefaultTemplate("CUSTOM");
    for (const section of config.sections) {
      expect(section.id).toBeTruthy();
      expect(section.type).toBeTruthy();
      expect(section.name).toBeTruthy();
      expect(typeof section.visible).toBe("boolean");
      expect(typeof section.position).toBe("number");
      expect(Array.isArray(section.fields)).toBe(true);
    }
  });

  it("all fields have required attributes", () => {
    const config = getDefaultTemplate("CUSTOM");
    for (const section of config.sections) {
      for (const field of section.fields) {
        expect(field.id).toBeTruthy();
        expect(field.name).toBeTruthy();
        expect(field.label).toBeTruthy();
        expect(field.type).toBeTruthy();
        expect(typeof field.required).toBe("boolean");
        expect(typeof field.visible).toBe("boolean");
        expect(typeof field.position).toBe("number");
      }
    }
  });
});

describe("conditional-logic", () => {
  it("evaluates equals operator", () => {
    expect(evaluateRule({ fieldId: "status", operator: "equals", value: "paid" }, { status: "paid" })).toBe(true);
    expect(evaluateRule({ fieldId: "status", operator: "equals", value: "paid" }, { status: "pending" })).toBe(false);
  });

  it("evaluates not_equals operator", () => {
    expect(evaluateRule({ fieldId: "status", operator: "not_equals", value: "paid" }, { status: "pending" })).toBe(true);
    expect(evaluateRule({ fieldId: "status", operator: "not_equals", value: "paid" }, { status: "paid" })).toBe(false);
  });

  it("evaluates exists operator", () => {
    expect(evaluateRule({ fieldId: "name", operator: "exists", value: "" }, { name: "test" })).toBe(true);
    expect(evaluateRule({ fieldId: "name", operator: "exists", value: "" }, { name: "" })).toBe(false);
    expect(evaluateRule({ fieldId: "name", operator: "exists", value: "" }, {})).toBe(false);
  });

  it("evaluates greater_than operator", () => {
    expect(evaluateRule({ fieldId: "amount", operator: "greater_than", value: 100 }, { amount: 150 })).toBe(true);
    expect(evaluateRule({ fieldId: "amount", operator: "greater_than", value: 100 }, { amount: 50 })).toBe(false);
  });

  it("evaluates less_than operator", () => {
    expect(evaluateRule({ fieldId: "amount", operator: "less_than", value: 100 }, { amount: 50 })).toBe(true);
    expect(evaluateRule({ fieldId: "amount", operator: "less_than", value: 100 }, { amount: 150 })).toBe(false);
  });

  it("evaluates contains operator", () => {
    expect(evaluateRule({ fieldId: "notes", operator: "contains", value: "urgent" }, { notes: "This is urgent" })).toBe(true);
    expect(evaluateRule({ fieldId: "notes", operator: "contains", value: "urgent" }, { notes: "This is normal" })).toBe(false);
  });

  it("evaluates in operator", () => {
    expect(evaluateRule({ fieldId: "type", operator: "in", value: ["A", "B"] }, { type: "A" })).toBe(true);
    expect(evaluateRule({ fieldId: "type", operator: "in", value: ["A", "B"] }, { type: "C" })).toBe(false);
  });

  it("evaluates compound conditions with and/or", () => {
    expect(evaluateCondition({ and: [
      { fieldId: "a", operator: "equals", value: 1 },
      { fieldId: "b", operator: "equals", value: 2 },
    ] }, { a: 1, b: 2 })).toBe(true);

    expect(evaluateCondition({ and: [
      { fieldId: "a", operator: "equals", value: 1 },
      { fieldId: "b", operator: "equals", value: 2 },
    ] }, { a: 1, b: 3 })).toBe(false);

    expect(evaluateCondition({ or: [
      { fieldId: "a", operator: "equals", value: 1 },
      { fieldId: "b", operator: "equals", value: 2 },
    ] }, { a: 1, b: 3 })).toBe(true);

    expect(evaluateCondition({ or: [
      { fieldId: "a", operator: "equals", value: 1 },
      { fieldId: "b", operator: "equals", value: 2 },
    ] }, { a: 2, b: 3 })).toBe(false);
  });

  it("returns true for empty condition", () => {
    expect(evaluateCondition(null, {})).toBe(true);
    expect(evaluateCondition(undefined, {})).toBe(true);
  });

  it("applies template defaults to missing fields", () => {
    const template = getDefaultTemplate("STANDARD");
    const result = applyTemplateDefaults(template, { customField: "test" });
    expect(result.customField).toBe("test");
  });

  it("evaluateTemplate returns visible sections and fields", () => {
    const template = getDefaultTemplate("STANDARD");
    const result = evaluateTemplate(template, {});
    expect(result.visibleSections.length).toBe(template.sections.length);
    expect(result.visibleFieldsBySection).toBeDefined();
  });
});

describe("template drag-and-drop helpers", () => {
  it("ALL_SECTION_TYPES lists every modular component type", () => {
    expect(ALL_SECTION_TYPES.length).toBe(25);
    expect(ALL_SECTION_TYPES).toContain("business_info");
    expect(ALL_SECTION_TYPES).toContain("milestone_info");
    expect(ALL_SECTION_TYPES).toContain("custom_field");
    expect(ALL_SECTION_TYPES).toContain("payment_button");
  });

  it("createTemplateSection builds a functional section with default fields", () => {
    const section = createTemplateSection("line_items", 3);
    expect(section.type).toBe("line_items");
    expect(section.position).toBe(3);
    expect(section.visible).toBe(true);
    expect(section.label).toBe("Line Items");
    expect(section.fields.length).toBeGreaterThan(0);
    expect(section.fields.every((f) => f.visible)).toBe(true);
    expect(section.id).toBeTruthy();
  });

  it("createTemplateSection marks structural sections as non-collapsible", () => {
    expect(createTemplateSection("business_info", 0).collapsible).toBe(false);
    expect(createTemplateSection("customer_info", 0).collapsible).toBe(false);
    expect(createTemplateSection("notes", 0).collapsible).toBe(true);
  });

  it("createTemplateSection assigns unique ids", () => {
    const a = createTemplateSection("notes", 0);
    const b = createTemplateSection("notes", 1);
    expect(a.id).not.toBe(b.id);
  });

  it("reorderTemplateSections moves an item and reassigns positions", () => {
    const template = getDefaultTemplate("STANDARD");
    const firstId = template.sections[0].id;
    const lastId = template.sections[template.sections.length - 1].id;

    const reordered = reorderTemplateSections(template.sections, lastId, firstId);

    expect(reordered.length).toBe(template.sections.length);
    expect(reordered[0].id).toBe(lastId);
    expect(reordered.map((s) => s.position)).toEqual(
      reordered.map((_, idx) => idx)
    );
  });

  it("reorderTemplateSections swaps two adjacent items", () => {
    const template = getDefaultTemplate("STANDARD");
    const [a, b] = template.sections;
    const reordered = reorderTemplateSections(template.sections, b.id, a.id);
    expect(reordered[0].id).toBe(b.id);
    expect(reordered[1].id).toBe(a.id);
  });

  it("reorderTemplateSections is a no-op when source equals target", () => {
    const template = getDefaultTemplate("STANDARD");
    const id = template.sections[2].id;
    const reordered = reorderTemplateSections(template.sections, id, id);
    expect(reordered).toBe(template.sections);
  });

  it("reorderTemplateSections is a no-op for unknown ids", () => {
    const template = getDefaultTemplate("STANDARD");
    const reordered = reorderTemplateSections(template.sections, "missing", "also-missing");
    expect(reordered).toBe(template.sections);
  });

  it("reorderTemplateSections preserves hidden (removed-from-canvas) sections", () => {
    const template = getDefaultTemplate("STANDARD");
    const target = createTemplateSection("notes", template.sections.length);
    const withTarget = [...template.sections, { ...target, visible: false }];
    const source = withTarget[0].id;
    const reordered = reorderTemplateSections(withTarget, source, target.id);
    expect(reordered.length).toBe(withTarget.length);
    expect(reordered[reordered.length - 1].id).toBe(source);
  });

  it("removeTemplateSection removes only the matched section", () => {
    const template = getDefaultTemplate("STANDARD");
    const toRemove = template.sections[1].id;
    const remaining = removeTemplateSection(template.sections, toRemove);
    expect(remaining.length).toBe(template.sections.length - 1);
    expect(remaining.find((s) => s.id === toRemove)).toBeUndefined();
  });

  it("a dragged library component renders when added to a template", () => {
    const template = getDefaultTemplate("STANDARD");
    const section = createTemplateSection("taxes", template.sections.length);
    const extended = { ...template, sections: [...template.sections, section] };
    const { visibleSections } = evaluateTemplate(extended, {});
    expect(visibleSections).toContainEqual(expect.objectContaining({ type: "taxes" }));
  });
});
