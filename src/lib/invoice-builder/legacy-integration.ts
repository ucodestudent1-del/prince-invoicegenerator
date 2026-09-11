import {
  DocumentModel,
  BaseComponent,
  AllComponentType,
  ComponentStyle,
} from "./document-model";
import { componentRegistry } from "./component-registry";
import {
  InvoiceTemplateConfig,
  InvoiceSectionConfig,
  InvoiceFieldConfig,
  SectionType,
  FieldType,
  DEFAULT_TEMPLATE_STYLING,
} from "../invoice-template-config";

export function documentToTemplateConfig(document: DocumentModel): InvoiceTemplateConfig {
  const sections: InvoiceSectionConfig[] = [];
  const fields: InvoiceFieldConfig[] = [];

  function processComponent(
    component: BaseComponent,
    parentSectionId?: string,
    position: number = 0
  ): InvoiceSectionConfig | null {
    const schema = componentRegistry[component.type as AllComponentType];
    if (!schema || schema.isLayout) return null;

    const sectionType = mapComponentTypeToSectionType(component.type);
    if (!sectionType) return null;

    const sectionId = `section_${component.type}_${component.id.slice(-6)}`;
    const sectionFields = mapComponentPropsToFields(component, sectionId);

    const section: InvoiceSectionConfig = {
      id: sectionId,
      type: sectionType,
      name: sectionType,
      label: schema.label,
      visible: true,
      collapsible: true,
      collapsed: false,
      position,
      required: false,
      fields: sectionFields,
      styling: mapComponentStyleToStyling(component.style),
    };

    return section;
  }

  function mapComponentPropsToFields(component: BaseComponent, sectionId: string): InvoiceFieldConfig[] {
    const schema = componentRegistry[component.type as AllComponentType];
    if (!schema) return [];

    const props = component.props || {};
    const fieldConfigs: InvoiceFieldConfig[] = [];

    Object.entries(props).forEach(([key, value], index) => {
      if (value === undefined || value === null || value === "") return;

      const fieldType = inferFieldType(value);
      let defaultValue: string | number | boolean | null | undefined = undefined;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) {
        defaultValue = value;
      }
      fieldConfigs.push({
        id: `field_${component.id}_${key}`,
        name: key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1"),
        type: fieldType,
        defaultValue,
        required: false,
        visible: true,
        position: index,
      });
    });

    return fieldConfigs;
  }

  function inferFieldType(value: unknown): FieldType {
    if (typeof value === "boolean") return "checkbox";
    if (typeof value === "number") return "number";
    if (typeof value === "string") {
      if (value.includes("@") && value.includes(".")) return "string";
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
      if (/^\$?\d+(\.\d{2})?$/.test(value)) return "currency";
      if (value.length > 100) return "textarea";
      return "string";
    }
    return "string";
  }

  function mapComponentStyleToStyling(style: ComponentStyle) {
    const styleRecord = style as Record<string, unknown>;
    return {
      backgroundColor: styleRecord.backgroundColor as string,
      borderColor: styleRecord.borderColor as string,
      textColor: styleRecord.color as string,
      fontSize: styleRecord.fontSize ? `${styleRecord.fontSize}pt` : undefined,
      fontWeight: styleRecord.fontWeight as string,
      padding: styleRecord.padding as string,
      margin: styleRecord.margin as string,
      borderRadius: styleRecord.borderRadius as string,
      borderWidth: styleRecord.borderWidth as string,
      borderStyle: styleRecord.borderStyle as string,
    };
  }

  function mapComponentTypeToSectionType(type: AllComponentType): SectionType | null {
    const mapping: Record<string, SectionType> = {
      businessInfo: "business_info",
      customerInfo: "customer_info",
      projectInfo: "project_info",
      invoiceNumber: "invoice_details",
      date: "invoice_details",
      lineItems: "line_items",
      laborTable: "labor_table",
      materialsTable: "materials_table",
      equipmentTable: "equipment_table",
      subtotal: "payment_summary",
      tax: "taxes",
      discount: "discounts",
      retainage: "retainage",
      previousPayments: "previous_payments",
      paymentTerms: "payment_terms",
      paymentSummary: "payment_summary",
      notes: "notes",
      terms: "terms",
      signature: "signature",
      qrCode: "qr_code",
      paymentButton: "payment_button",
      milestoneInfo: "milestone_info",
      changeOrders: "change_orders",
      scheduleOfValues: "schedule_of_values",
      text: "custom_field",
      image: "custom_field",
      customField: "custom_field",
    };

    return mapping[type] || null;
  }

  const rootComponents = document.rootIds
    .map((id) => document.components.get(id))
    .filter(Boolean);

  rootComponents.forEach((root, index) => {
    if (root) {
      const section = processComponent(root, undefined, index);
      if (section) {
        sections.push(section);
        fields.push(...section.fields);
      }

      if (root.children) {
        root.children.forEach((childId, childIndex) => {
          const child = document.components.get(childId);
          if (child) {
            const section = processComponent(child, root.id, childIndex);
            if (section) {
              sections.push(section);
              fields.push(...section.fields);
            }
          }
        });
      }
    }
  });

  return {
    id: document.id,
    templateId: document.id,
    name: document.name,
    description: `Invoice builder template for ${document.invoiceType}`,
    invoiceType: document.invoiceType as any,
    sections,
    fields,
    styling: DEFAULT_TEMPLATE_STYLING,
    rules: [],
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function templateConfigToDocument(config: InvoiceTemplateConfig): DocumentModel {
  // This would convert the legacy template config back to the new document model
  // For now, return a basic document
  return {
    id: config.id,
    name: config.name,
    version: 1,
    invoiceType: config.invoiceType,
    components: new Map(),
    rootIds: [],
    createdAt: config.createdAt || new Date(),
    updatedAt: config.updatedAt || new Date(),
  };
}

export function createDocumentFromLegacyTemplate(invoiceType: string): DocumentModel {
  // Create a default document structure based on the legacy template system
  const { createDefaultInvoiceDocument } = require("./document-operations");
  return createDefaultInvoiceDocument(invoiceType);
}