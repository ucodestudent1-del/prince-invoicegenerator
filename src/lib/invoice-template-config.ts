import type { InvoiceType } from "@prisma/client";

export type FieldType =
  | "string"
  | "number"
  | "date"
  | "currency"
  | "percentage"
  | "textarea"
  | "select"
  | "checkbox"
  | "boolean"
  | "file"
  | "signature"
  | "qrcode"
  | "payment_button"
  | "custom";

export type SectionType =
  | "business_info"
  | "customer_info"
  | "project_info"
  | "invoice_details"
  | "line_items"
  | "labor_table"
  | "materials_table"
  | "equipment_table"
  | "change_orders"
  | "schedule_of_values"
  | "retainage"
  | "previous_payments"
  | "discounts"
  | "taxes"
  | "payment_terms"
  | "payment_summary"
  | "notes"
  | "terms"
  | "signature"
  | "photos"
  | "attachments"
  | "qr_code"
  | "payment_button"
  | "milestone_info"
  | "custom_field";

export interface InvoiceFieldConfig {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  defaultValue?: string | number | boolean | null;
  placeholder?: string;
  required: boolean;
  visible: boolean;
  position: number;
  options?: { value: string; label: string }[];
  format?: string;
  decimalPlaces?: number;
  prefix?: string;
  suffix?: string;
  width?: "sm" | "md" | "lg" | "full";
  helpText?: string;
  conditional?: {
    fieldId: string;
    operator: "equals" | "not_equals" | "exists" | "greater_than" | "less_than";
    value: string | number | boolean;
  };
}

export interface InvoiceSectionConfig {
  id: string;
  type: SectionType;
  name: string;
  label: string;
  visible: boolean;
  collapsible: boolean;
  collapsed: boolean;
  position: number;
  required: boolean;
  fields: InvoiceFieldConfig[];
  columns?: number;
  styling?: {
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    fontSize?: string;
    fontWeight?: string;
    padding?: string;
    margin?: string;
    borderRadius?: string;
    borderWidth?: string;
    borderStyle?: string;
    className?: string;
  };
  conditional?: {
    fieldId: string;
    operator: "equals" | "not_equals" | "exists" | "greater_than" | "less_than";
    value: string | number | boolean;
  };
}

export interface InvoiceTemplateStyling {
  colors: {
    primary: string;
    accent: string;
    headerBg: string;
    headerText: string;
    bodyBg: string;
    bodyText: string;
    border: string;
    tableHeaderBg: string;
    tableHeaderText: string;
    tableRowAlt: string;
    totalRowBg: string;
    watermark: string;
  };
  fonts: {
    headerFont: string;
    bodyFont: string;
    headerSize: string;
    bodySize: string;
    lineItemSize: string;
  };
  layout: {
    paperSize: "A4" | "Letter" | "Legal" | "Custom";
    orientation: "portrait" | "landscape";
    margins: { top: string; right: string; bottom: string; left: string };
    padding: string;
    columnGap: string;
    rowGap: string;
    logoWidth: string;
    logoHeight: string;
    sectionSpacing: string;
    itemSpacing: string;
  };
  table: {
    showBorders: boolean;
    showAlternatingRows: boolean;
    headerAlignment: "left" | "center" | "right";
    bodyAlignment: "left" | "center" | "right";
    showLineNumbers: boolean;
    showSkuColumn: boolean;
    showDescription: boolean;
    showQuantity: boolean;
    showUnitPrice: boolean;
    showTaxColumn: boolean;
    showDiscountColumn: boolean;
    showTotalColumn: boolean;
  };
  header: {
    showLogo: boolean;
    showOrgName: boolean;
    showOrgTagline: boolean;
    showContactInfo: boolean;
    showTaxId: boolean;
    alignment: "left" | "center" | "right";
  };
  footer: {
    showPageNumbers: boolean;
    showTerms: boolean;
    showNotes: boolean;
    showQrCode: boolean;
    showPaymentButton: boolean;
    text: string;
    alignment: "left" | "center" | "right";
  };
  totals: {
    showSubtotal: boolean;
    showTax: boolean;
    showDiscount: boolean;
    showRetainage: boolean;
    showLateFees: boolean;
    showAmountPaid: boolean;
    showBalanceDue: boolean;
    showTaxId: boolean;
    showPaymentTerms: boolean;
    alignment: "left" | "right";
    fontSize: string;
    fontWeight: string;
  };
}

export interface InvoiceTemplateConfig {
  id: string;
  templateId?: string;
  name: string;
  description: string;
  invoiceType: InvoiceType;
  sections: InvoiceSectionConfig[];
  fields: InvoiceFieldConfig[];
  styling: InvoiceTemplateStyling;
  rules: Array<{
    id: string;
    trigger: "invoice_type" | "project_selected" | "customer_selected" | "has_change_orders" | "retainage_enabled" | "milestone_linked";
    condition: string;
    action: "show_section" | "hide_section" | "show_field" | "hide_field" | "set_default";
    targetId: string;
    value?: string | number | boolean;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
}

export const DEFAULT_TEMPLATE_STYLING: InvoiceTemplateStyling = {
  colors: {
    primary: "#3b82f6",
    accent: "#3b82f6",
    headerBg: "transparent",
    headerText: "#1f2937",
    bodyBg: "white",
    bodyText: "#1f2937",
    border: "#e5e7eb",
    tableHeaderBg: "#f9fafb",
    tableHeaderText: "#374151",
    tableRowAlt: "#f9fafb",
    totalRowBg: "#f3f4f6",
    watermark: "#e5e7eb",
  },
  fonts: {
    headerFont: "'Inter', system-ui, sans-serif",
    bodyFont: "'Inter', system-ui, sans-serif",
    headerSize: "14pt",
    bodySize: "10pt",
    lineItemSize: "10pt",
  },
  layout: {
    paperSize: "A4",
    orientation: "portrait",
    margins: { top: "15mm", right: "12mm", bottom: "15mm", left: "12mm" },
    padding: "0",
    columnGap: "16px",
    rowGap: "12px",
    logoWidth: "120px",
    logoHeight: "auto",
    sectionSpacing: "16px",
    itemSpacing: "8px",
  },
  table: {
    showBorders: true,
    showAlternatingRows: false,
    headerAlignment: "left",
    bodyAlignment: "left",
    showLineNumbers: true,
    showSkuColumn: false,
    showDescription: true,
    showQuantity: true,
    showUnitPrice: true,
    showTaxColumn: false,
    showDiscountColumn: false,
    showTotalColumn: true,
  },
  header: {
    showLogo: true,
    showOrgName: true,
    showOrgTagline: false,
    showContactInfo: true,
    showTaxId: false,
    alignment: "left",
  },
  footer: {
    showPageNumbers: false,
    showTerms: true,
    showNotes: true,
    showQrCode: false,
    showPaymentButton: false,
    text: "",
    alignment: "left",
  },
  totals: {
    showSubtotal: true,
    showTax: true,
    showDiscount: true,
    showRetainage: true,
    showLateFees: false,
    showAmountPaid: false,
    showBalanceDue: true,
    showTaxId: false,
    showPaymentTerms: false,
    alignment: "right",
    fontSize: "10pt",
    fontWeight: "bold",
  },
};

export const BUILT_IN_TEMPLATES: Record<string, { name: string; invoiceType: InvoiceType; description: string }> = {
  residential_invoice: {
    name: "Residential Invoice",
    invoiceType: "STANDARD",
    description: "Standard invoice for residential construction work",
  },
  commercial_progress: {
    name: "Commercial Progress Billing",
    invoiceType: "PROGRESS",
    description: "Progress billing with retainage and schedule of values",
  },
  time_and_materials: {
    name: "Time & Materials Invoice",
    invoiceType: "TIME_AND_MATERIALS",
    description: "Invoice with separated labor, materials, and equipment tables",
  },
  change_order: {
    name: "Change Order",
    invoiceType: "CHANGE_ORDER",
    description: "Change order with before/after line tracking",
  },
  roofing_invoice: {
    name: "Roofing Invoice",
    invoiceType: "STANDARD",
    description: "Standard invoice for roofing contractors",
  },
  remodel_invoice: {
    name: "Remodel Invoice",
    invoiceType: "STANDARD",
    description: "Standard invoice for remodeling contractors",
  },
  final_invoice: {
    name: "Final Invoice",
    invoiceType: "FINAL",
    description: "Final invoice for contract completion",
  },
  deposit_invoice: {
    name: "Deposit Invoice",
    invoiceType: "DEPOSIT",
    description: "Upfront deposit before work begins",
  },
  retainage_release: {
    name: "Retainage Release",
    invoiceType: "RETAINAGE",
    description: "Release of withheld retainage upon milestone completion",
  },
  milestone_invoice: {
    name: "Milestone Invoice",
    invoiceType: "MILESTONE",
    description: "Invoice tied to a specific project milestone",
  },
  fixed_price: {
    name: "Fixed Price Invoice",
    invoiceType: "FIXED_PRICE",
    description: "Lump-sum invoice for a defined scope of work",
  },
  custom_invoice: {
    name: "Custom Invoice",
    invoiceType: "CUSTOM",
    description: "Fully customizable invoice with all sections available",
  },
};

export function getDefaultSections(invoiceType: InvoiceType): SectionType[] {
  const typeMap: Record<InvoiceType, SectionType[]> = {
    STANDARD: ["business_info", "customer_info", "invoice_details", "line_items", "payment_summary", "taxes", "payment_terms", "notes"],
    FIXED_PRICE: ["business_info", "customer_info", "project_info", "invoice_details", "line_items", "payment_summary", "schedule_of_values", "taxes", "payment_terms", "notes"],
    TIME_AND_MATERIALS: ["business_info", "customer_info", "project_info", "invoice_details", "labor_table", "materials_table", "equipment_table", "payment_summary", "taxes", "payment_terms", "notes"],
    PROGRESS: ["business_info", "customer_info", "project_info", "invoice_details", "schedule_of_values", "change_orders", "retainage", "previous_payments", "payment_summary", "taxes", "payment_terms", "notes"],
    MILESTONE: ["business_info", "customer_info", "project_info", "invoice_details", "schedule_of_values", "milestone_info", "retainage", "taxes", "payment_terms", "notes"],
    CHANGE_ORDER: ["business_info", "customer_info", "project_info", "invoice_details", "change_orders", "schedule_of_values", "taxes", "payment_terms", "notes"],
    DEPOSIT: ["business_info", "customer_info", "project_info", "invoice_details", "line_items", "payment_terms", "notes"],
    RETAINAGE: ["business_info", "customer_info", "project_info", "invoice_details", "retainage", "previous_payments", "payment_terms", "notes"],
    FINAL: ["business_info", "customer_info", "project_info", "invoice_details", "schedule_of_values", "change_orders", "retainage", "previous_payments", "taxes", "payment_terms", "notes"],
    RECURRING: ["business_info", "customer_info", "invoice_details", "line_items", "taxes", "payment_terms", "notes"],
    EXPENSE: ["business_info", "customer_info", "invoice_details", "line_items", "taxes", "payment_terms", "notes"],
    CUSTOM: ["business_info", "customer_info", "project_info", "invoice_details", "line_items", "labor_table", "materials_table", "equipment_table", "change_orders", "schedule_of_values", "retainage", "previous_payments", "discounts", "taxes", "payment_terms", "notes", "terms", "signature", "photos", "attachments", "qr_code", "payment_button"],
  };
  return typeMap[invoiceType] ?? typeMap["STANDARD"];
}

export function buildDefaultTemplate(invoiceType: InvoiceType): Omit<InvoiceTemplateConfig, "id" | "createdAt" | "updatedAt" | "createdBy"> {
  const sectionTypes = getDefaultSections(invoiceType);
  const sections: InvoiceSectionConfig[] = sectionTypes.map((type, idx) => ({
    id: `section_${type}`,
      type: type,
    name: type,
    label: getSectionLabel(type),
    visible: true,
    collapsible: type !== "business_info" && type !== "customer_info",
    collapsed: false,
    position: idx,
    required: false,
    fields: getDefaultFieldsForSection(type),
  }));

  const fields = sections.flatMap((s) => s.fields);

  return {
    name: BUILT_IN_TEMPLATES[invoiceType.toLowerCase() as keyof typeof BUILT_IN_TEMPLATES]?.["name"] ?? "Custom Invoice",
    description: BUILT_IN_TEMPLATES[invoiceType.toLowerCase() as keyof typeof BUILT_IN_TEMPLATES]?.["description"] ?? "",
    invoiceType,
    sections,
    fields,
    styling: { ...DEFAULT_TEMPLATE_STYLING },
    rules: getDefaultRules(invoiceType),
  };
}

export function getDefaultTemplate(invoiceType: InvoiceType): InvoiceTemplateConfig {
  const built = buildDefaultTemplate(invoiceType);
  return {
    id: `default_${invoiceType.toLowerCase()}`,
    name: built.name,
    description: built.description,
    invoiceType,
    sections: built.sections,
    fields: built.fields,
    styling: built.styling,
    rules: built.rules,
  };
}

export function convertToLegacyTemplate(config: InvoiceTemplateConfig) {
  const sectionTypes = config.sections.map((s) => s.type);
  const sectionMap = {
    details: sectionTypes.includes("invoice_details"),
    billTo: sectionTypes.includes("customer_info"),
    shipTo: sectionTypes.includes("customer_info"),
    lineItems: sectionTypes.includes("line_items"),
    tax: sectionTypes.includes("taxes"),
    discount: sectionTypes.includes("discounts"),
    retainage: sectionTypes.includes("retainage"),
    notes: sectionTypes.includes("notes"),
    milestones: sectionTypes.includes("milestone_info"),
    changeOrders: sectionTypes.includes("change_orders"),
    progressSummary: sectionTypes.includes("schedule_of_values"),
  };

  const features = {
    requiresProject: config.invoiceType === "PROGRESS" || config.invoiceType === "MILESTONE" || config.invoiceType === "FIXED_PRICE" || config.invoiceType === "TIME_AND_MATERIALS" || config.invoiceType === "CHANGE_ORDER" || config.invoiceType === "DEPOSIT" || config.invoiceType === "RETAINAGE" || config.invoiceType === "FINAL",
    supportsRetainage: config.invoiceType === "FIXED_PRICE" || config.invoiceType === "PROGRESS" || config.invoiceType === "MILESTONE" || config.invoiceType === "CHANGE_ORDER" || config.invoiceType === "RETAINAGE" || config.invoiceType === "FINAL" || config.invoiceType === "CUSTOM",
    supportsMilestones: config.invoiceType === "PROGRESS" || config.invoiceType === "MILESTONE" || config.invoiceType === "RETAINAGE" || config.invoiceType === "CUSTOM",
    supportsChangeOrders: config.invoiceType === "FIXED_PRICE" || config.invoiceType === "PROGRESS" || config.invoiceType === "CHANGE_ORDER" || config.invoiceType === "FINAL" || config.invoiceType === "CUSTOM",
    supportsTimeTracking: config.invoiceType === "STANDARD" || config.invoiceType === "PROGRESS" || config.invoiceType === "MILESTONE" || config.invoiceType === "RECURRING" || config.invoiceType === "TIME_AND_MATERIALS" || config.invoiceType === "CUSTOM",
    supportsCatalog: true,
  };

  const defaults = {
    taxRate: 0,
    discount: 0,
    retainageRate: config.invoiceType === "FIXED_PRICE" ? 5 : config.invoiceType === "PROGRESS" ? 10 : 0,
    billingIntent: config.invoiceType === "DEPOSIT" ? "DEPOSIT" as const : config.invoiceType === "FINAL" ? "FINAL" as const : config.invoiceType === "FIXED_PRICE" ? "PROGRESS" as const : config.invoiceType === "CHANGE_ORDER" ? "CUSTOM" as const : null,
  };

  return {
    id: config.invoiceType,
    label: config.name,
    description: config.description,
    sections: sectionMap,
    defaults,
    features,
    suggestions: {
      depositPercent: config.invoiceType === "DEPOSIT" ? 10 : undefined,
      fillRemaining: config.invoiceType === "FINAL",
      suggestTimeEntries: features.supportsTimeTracking,
      retainageRate: defaults.retainageRate,
    },
  };
}


function getSectionLabel(type: SectionType | string): string {
  const labels: Record<string, string> = {
    business_info: "Business Information",
    customer_info: "Customer Information",
    project_info: "Project Information",
    invoice_details: "Invoice Details",
    line_items: "Line Items",
    labor_table: "Labor",
    materials_table: "Materials",
    equipment_table: "Equipment",
    change_orders: "Change Orders",
    schedule_of_values: "Schedule of Values",
    retainage: "Retainage",
    previous_payments: "Previous Payments",
    discounts: "Discounts & Fees",
    taxes: "Taxes",
    payment_summary: "Payment Summary",
    payment_terms: "Payment Terms",
    notes: "Notes",
    terms: "Terms & Conditions",
    signature: "Signature",
    photos: "Photos",
    attachments: "Attachments",
    qr_code: "QR Code",
    payment_button: "Pay Online",
    milestone_info: "Milestone Information",
    custom_field: "Custom Field",
  };
  return labels[type] ?? type;
}

function getDefaultFieldsForSection(type: SectionType | string): InvoiceFieldConfig[] {
  const baseField = (id: string, name: string, label: string, ft: FieldType, pos: number): InvoiceFieldConfig => ({
    id,
    name,
    label,
    type: ft,
    required: false,
    visible: true,
    position: pos,
  });

  const fieldMaps: Record<string, InvoiceFieldConfig[]> = {
    business_info: [
      baseField("org_logo", "logoUrl", "Logo", "file", 0),
      baseField("org_name", "orgName", "Business Name", "string", 1),
      baseField("org_tagline", "orgTagline", "Tagline", "string", 2),
      baseField("org_address", "orgAddress", "Address", "textarea", 3),
      baseField("org_phone", "orgPhone", "Phone", "string", 4),
      baseField("org_email", "orgEmail", "Email", "string", 5),
      baseField("org_tax_id", "orgTaxId", "Tax ID", "string", 6),
    ],
    customer_info: [
      baseField("cust_name", "customerName", "Customer Name", "string", 0),
      baseField("cust_company", "customerCompany", "Company", "string", 1),
      baseField("cust_address", "customerAddress", "Billing Address", "textarea", 2),
      baseField("cust_email", "customerEmail", "Email", "string", 3),
      baseField("cust_phone", "customerPhone", "Phone", "string", 4),
      baseField("cust_tax_id", "customerTaxId", "Tax ID", "string", 5),
    ],
    project_info: [
      baseField("proj_name", "projectName", "Project Name", "string", 0),
      baseField("proj_number", "projectNumber", "Project Number", "string", 1),
      baseField("proj_address", "projectAddress", "Project Address", "textarea", 2),
      baseField("proj_manager", "projectManager", "Project Manager", "string", 3),
      baseField("proj_start_date", "projectStartDate", "Start Date", "date", 4),
      baseField("proj_end_date", "projectEndDate", "End Date", "date", 5),
    ],
    invoice_details: [
      baseField("inv_number", "invoiceNumber", "Invoice #", "string", 0),
      baseField("inv_issue_date", "issueDate", "Issue Date", "date", 1),
      baseField("inv_due_date", "dueDate", "Due Date", "date", 2),
      baseField("inv_type", "type", "Type", "select", 3),
      baseField("inv_status", "status", "Status", "select", 4),
      baseField("inv_currency", "currency", "Currency", "select", 5),
    ],
    line_items: [
      baseField("item_description", "description", "Description", "string", 0),
      baseField("item_quantity", "quantity", "Qty", "number", 1),
      baseField("item_unit_price", "unitPrice", "Unit Price", "currency", 2),
      baseField("item_taxable", "taxable", "Taxable", "checkbox", 3),
      baseField("item_sku", "sku", "SKU", "string", 4),
    ],
    labor_table: [
      baseField("labor_description", "description", "Labor Description", "string", 0),
      baseField("labor_hours", "hours", "Hours", "number", 1),
      baseField("labor_rate", "rate", "Hourly Rate", "currency", 2),
      baseField("labor_amount", "amount", "Amount", "currency", 3),
    ],
    materials_table: [
      baseField("mat_description", "description", "Material", "string", 0),
      baseField("mat_quantity", "quantity", "Qty", "number", 1),
      baseField("mat_unit_price", "unitPrice", "Unit Price", "currency", 2),
      baseField("mat_amount", "amount", "Amount", "currency", 3),
    ],
    equipment_table: [
      baseField("equip_description", "description", "Equipment", "string", 0),
      baseField("equip_days", "days", "Days", "number", 1),
      baseField("equip_rate", "rate", "Daily Rate", "currency", 2),
      baseField("equip_amount", "amount", "Amount", "currency", 3),
    ],
    change_orders: [
      baseField("co_number", "changeOrderNumber", "CO #", "string", 0),
      baseField("co_description", "changeOrderDescription", "Description", "textarea", 1),
      baseField("co_amount", "changeOrderAmount", "Amount", "currency", 2),
      baseField("co_status", "changeOrderStatus", "Status", "select", 3),
    ],
    schedule_of_values: [
      baseField("sov_line_item", "lineItem", "Line Item", "string", 0),
      baseField("sov_amount", "amount", "Amount", "currency", 1),
      baseField("sov_completed", "completedPercent", "% Complete", "percentage", 2),
      baseField("sov_billed", "billed", "Billed", "boolean", 3),
    ],
    retainage: [
      baseField("ret_rate", "retainageRate", "Retainage %", "percentage", 0),
      baseField("ret_amount", "retainageAmount", "Retainage Amount", "currency", 1),
      baseField("ret_released", "retainageReleased", "Released", "boolean", 2),
    ],
    previous_payments: [
      baseField("prev_payment_date", "paymentDate", "Payment Date", "date", 0),
      baseField("prev_payment_amount", "paymentAmount", "Amount", "currency", 1),
      baseField("prev_payment_method", "paymentMethod", "Method", "select", 2),
    ],
    discounts: [
      baseField("disc_type", "discountType", "Type", "select", 0),
      baseField("disc_value", "discountValue", "Value", "number", 1),
      baseField("disc_amount", "discountAmount", "Amount", "currency", 2),
    ],
    taxes: [
      baseField("tax_rate", "taxRate", "Tax Rate %", "percentage", 0),
      baseField("tax_amount", "taxAmount", "Tax Amount", "currency", 1),
      baseField("tax_id", "taxId", "Tax ID", "string", 2),
    ],
    payment_summary: [
      baseField("summary_subtotal", "subtotal", "Subtotal", "currency", 0),
      baseField("summary_discount", "discount", "Discount", "currency", 1),
      baseField("summary_tax", "taxAmount", "Tax", "currency", 2),
      baseField("summary_retainage", "retainageAmount", "Retainage", "currency", 3),
      baseField("summary_total", "total", "Total", "currency", 4),
      baseField("summary_paid", "amountPaid", "Amount Paid", "currency", 5),
      baseField("summary_balance", "balanceDue", "Balance Due", "currency", 6),
    ],
    milestone_info: [
      baseField("milestone_title", "milestoneTitle", "Milestone Title", "string", 0),
      baseField("milestone_description", "milestoneDescription", "Description", "textarea", 1),
      baseField("milestone_date", "milestoneDate", "Date", "date", 2),
      baseField("milestone_amount", "milestoneAmount", "Amount", "currency", 3),
      baseField("milestone_completed", "milestoneCompleted", "Completed", "checkbox", 4),
    ],
    payment_terms: [
      baseField("terms_text", "paymentTerms", "Terms", "string", 0),
      baseField("terms_due_date", "dueDate", "Due Date", "date", 1),
      baseField("terms_notes", "termsNotes", "Notes", "textarea", 2),
    ],
    notes: [
      baseField("notes_text", "notes", "Notes", "textarea", 0),
    ],
    terms: [
      baseField("terms_text", "termsAndConditions", "Terms & Conditions", "textarea", 0),
    ],
    signature: [
      baseField("sig_image", "signature", "Signature", "signature", 0),
      baseField("sig_signed_by", "signedBy", "Signed By", "string", 1),
      baseField("sig_date", "signedDate", "Date", "date", 2),
    ],
    photos: [
      baseField("photo_attachments", "photos", "Photos", "file", 0),
    ],
    attachments: [
      baseField("attachment_files", "attachments", "Attachments", "file", 0),
    ],
    qr_code: [
      baseField("qr_data", "qrData", "QR Code Data", "string", 0),
    ],
    payment_button: [
      baseField("pay_btn_url", "paymentUrl", "Payment URL", "string", 0),
      baseField("pay_btn_label", "buttonLabel", "Button Label", "string", 1),
    ],
    custom_field: [
      baseField("custom_field_1", "customField1", "Custom Field", "string", 0),
    ],
  };

  return fieldMaps[type] ?? [];
}

function getDefaultRules(invoiceType: InvoiceType): InvoiceTemplateConfig["rules"] {
  return [];
}
