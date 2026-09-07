import type { InvoiceTemplateConfig, InvoiceSectionConfig, InvoiceFieldConfig } from "./invoice-template-config";

export type EvaluationContext = Record<string, any>;

export interface ConditionalRule {
  fieldId: string;
  operator: "equals" | "not_equals" | "exists" | "not_exists" | "greater_than" | "less_than" | "contains" | "not_contains" | "in" | "not_in";
  value: any;
}

export function evaluateRule(rule: ConditionalRule, context: EvaluationContext): boolean {
  const fieldValue = context[rule["fieldId"]];
  
  switch (rule["operator"]) {
    case "equals":
      return fieldValue === rule["value"];
    case "not_equals":
      return fieldValue !== rule["value"];
    case "exists":
      return fieldValue != null && fieldValue !== "";
    case "not_exists":
      return fieldValue == null || fieldValue === "";
    case "greater_than":
      return Number(fieldValue) > Number(rule["value"]);
    case "less_than":
      return Number(fieldValue) < Number(rule["value"]);
    case "contains":
      return String(fieldValue).includes(String(rule["value"]));
    case "not_contains":
      return !String(fieldValue).includes(String(rule["value"]));
    case "in":
      return Array.isArray(rule["value"]) && rule["value"].includes(fieldValue);
    case "not_in":
      return Array.isArray(rule["value"]) && !rule["value"].includes(fieldValue);
    default:
      return true;
  }
}

export function evaluateCondition(condition: any, context: EvaluationContext): boolean {
  if (!condition) return true;
  
  if (Array.isArray(condition)) {
    return condition.every((rule) => evaluateRule(rule, context));
  }
  
  if (typeof condition === "object" && condition !== null) {
    if ("and" in condition) {
      return condition["and"].every((rule: any) => evaluateCondition(rule, context));
    }
    if ("or" in condition) {
      return condition["or"].some((rule: any) => evaluateCondition(rule, context));
    }
    if ("not" in condition) {
      return !evaluateCondition(condition["not"], context);
    }
    return evaluateRule(condition as ConditionalRule, context);
  }
  
  return true;
}

export function computeSectionVisibility(section: InvoiceSectionConfig, context: EvaluationContext): boolean {
  if (section["visible"] === false) return false;
  
  if (section["conditional"]) {
    return evaluateCondition(section["conditional"], context);
  }
  
  return true;
}

export function computeFieldVisibility(field: InvoiceFieldConfig, context: EvaluationContext): boolean {
  if (field["visible"] === false) return false;
  
  if (field["conditional"]) {
    return evaluateCondition(field["conditional"], context);
  }
  
  return true;
}

export interface TemplateEvaluationResult {
  visibleSections: InvoiceSectionConfig[];
  visibleFieldsBySection: Record<string, InvoiceFieldConfig[]>;
  context: EvaluationContext;
}

export function evaluateTemplate(
  template: InvoiceTemplateConfig,
  context: EvaluationContext
): TemplateEvaluationResult {
  const visibleSections: InvoiceSectionConfig[] = [];
  const visibleFieldsBySection: Record<string, InvoiceFieldConfig[]> = {};
  
  for (const section of template["sections"]) {
    const sectionVisible = computeSectionVisibility(section, context);
    if (!sectionVisible) continue;
    
    visibleSections.push(section);
    
    const visibleFields = (section["fields"] ?? []).filter((field) =>
      computeFieldVisibility(field, context)
    );
    
    visibleFieldsBySection[section["id"]] = visibleFields;
  }
  
  return {
    visibleSections,
    visibleFieldsBySection,
    context,
  };
}

export function applyTemplateDefaults(
  template: InvoiceTemplateConfig,
  data: EvaluationContext
): EvaluationContext {
  const result: EvaluationContext = { ...data };
  
  for (const section of template["sections"]) {
    for (const field of section["fields"] ?? []) {
      if (field["defaultValue"] !== undefined && result[field["id"]] === undefined) {
        result[field["id"]] = field["defaultValue"];
      }
    }
  }
  
  return result;
}
