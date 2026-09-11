import { z } from "zod";
import {
  ComponentType,
  LayoutComponentType,
  AllComponentType,
  BaseComponent,
  ComponentStyle,
  componentStyleSchema,
  baseComponentSchema,
  generateId,
} from "./document-model";

export interface ComponentSchema {
  type: AllComponentType;
  label: string;
  description: string;
  icon: string;
  category: "layout" | "business" | "content" | "totals" | "advanced";
  schema: z.ZodObject<any>;
  defaultProps: Record<string, unknown>;
  defaultStyle: ComponentStyle;
  allowedParents: LayoutComponentType[];
  allowedChildren?: AllComponentType[];
  isLayout: boolean;
  render: (component: BaseComponent, context: RenderContext) => React.ReactNode;
  inspector?: (component: BaseComponent, onChange: (props: Record<string, unknown>) => void) => React.ReactNode;
}

export interface RenderContext {
  mode: "editor" | "preview" | "pdf";
  data: Record<string, unknown>;
  locale: string;
  currency: string;
}

export const textComponentSchema = z.object({
  content: z.string().default("Enter text..."),
  format: z.enum(["plain", "markdown", "html"]).default("plain"),
  visibilityCondition: z.string().optional(),
});

export const imageComponentSchema = z.object({
  src: z.string().url().optional().or(z.literal("")),
  alt: z.string().default("Image"),
  width: z.string().default("auto"),
  height: z.string().default("auto"),
  objectFit: z.enum(["cover", "contain", "fill", "none", "scale-down"]).default("contain"),
  linkUrl: z.string().url().optional().or(z.literal("")),
});

export const customerInfoComponentSchema = z.object({
  fields: z
    .array(
      z.enum(["name", "company", "address", "email", "phone", "taxId", "contactPerson"])
    )
    .default(["name", "address", "email", "phone"]),
  layout: z.enum(["vertical", "horizontal"]).default("vertical"),
  showLabels: z.boolean().default(true),
  labelWidth: z.string().default("120px"),
});

export const invoiceNumberComponentSchema = z.object({
  prefix: z.string().default("INV-"),
  format: z.string().default("{prefix}{year}{sequence:04d}"),
  showLabel: z.boolean().default(true),
  label: z.string().default("Invoice #"),
});

export const dateComponentSchema = z.object({
  dateType: z.enum(["issue", "due", "custom"]).default("issue"),
  customDate: z.string().optional(),
  format: z.string().default("MM/DD/YYYY"),
  showLabel: z.boolean().default(true),
  label: z.string().default("Date"),
});

export const lineItemsComponentSchema = z.object({
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        width: z.string().optional(),
        align: z.enum(["left", "center", "right"]).default("left"),
        format: z.enum(["text", "currency", "number", "percentage", "date"]).optional(),
      })
    )
    .default([
      { key: "description", label: "Description", align: "left" },
      { key: "quantity", label: "Qty", align: "center" },
      { key: "unitPrice", label: "Unit Price", align: "right", format: "currency" },
      { key: "total", label: "Total", align: "right", format: "currency" },
    ]),
  showLineNumbers: z.boolean().default(true),
  showHeaders: z.boolean().default(true),
  stripedRows: z.boolean().default(false),
  hoverHighlight: z.boolean().default(true),
  allowAddRows: z.boolean().default(true),
  allowDeleteRows: z.boolean().default(true),
  allowReorderRows: z.boolean().default(true),
  currency: z.string().default("USD"),
  taxColumn: z.boolean().default(false),
  discountColumn: z.boolean().default(false),
  multiPage: z.boolean().default(true),
  emptyStateText: z.string().default("No line items added"),
});

export const subtotalComponentSchema = z.object({
  showLabel: z.boolean().default(true),
  label: z.string().default("Subtotal"),
  alignment: z.enum(["left", "right"]).default("right"),
  fontWeight: z.enum(["normal", "bold"]).default("bold"),
});

export const taxComponentSchema = z.object({
  showLabel: z.boolean().default(true),
  label: z.string().default("Tax"),
  showRate: z.boolean().default(true),
  alignment: z.enum(["left", "right"]).default("right"),
  fontWeight: z.enum(["normal", "bold"]).default("normal"),
});

export const discountComponentSchema = z.object({
  showLabel: z.boolean().default(true),
  label: z.string().default("Discount"),
  discountType: z.enum(["percentage", "fixed"]).default("percentage"),
  alignment: z.enum(["left", "right"]).default("right"),
  fontWeight: z.enum(["normal", "bold"]).default("normal"),
});

export const paymentTermsComponentSchema = z.object({
  terms: z.string().default("Net 30 days"),
  dueDateLabel: z.string().default("Due Date"),
  showDueDate: z.boolean().default(true),
  lateFeeInfo: z.string().optional(),
  paymentMethods: z.array(z.string()).default([]),
  showBankDetails: z.boolean().default(false),
  bankDetails: z.string().optional(),
});

export const signatureComponentSchema = z.object({
  showSignerName: z.boolean().default(true),
  showSignerTitle: z.boolean().default(true),
  showDate: z.boolean().default(true),
  signatureWidth: z.string().default("200px"),
  signatureHeight: z.string().default("80px"),
  label: z.string().default("Authorized Signature"),
});

export const customFieldComponentSchema = z.object({
  fieldKey: z.string(),
  label: z.string(),
  fieldType: z.enum(["text", "textarea", "number", "currency", "date", "select", "checkbox"]).default("text"),
  defaultValue: z.unknown().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
});

export const businessInfoComponentSchema = z.object({
  fields: z
    .array(
      z.enum(["logo", "name", "tagline", "address", "phone", "email", "taxId", "website"])
    )
    .default(["logo", "name", "address", "phone", "email"]),
  layout: z.enum(["vertical", "horizontal"]).default("vertical"),
  logoWidth: z.string().default("120px"),
  logoHeight: z.string().default("auto"),
  showLabels: z.boolean().default(false),
});

export const projectInfoComponentSchema = z.object({
  fields: z
    .array(
      z.enum(["name", "number", "address", "manager", "startDate", "endDate", "description"])
    )
    .default(["name", "number", "address", "manager"]),
  layout: z.enum(["vertical", "horizontal"]).default("vertical"),
  showLabels: z.boolean().default(true),
});

export const notesComponentSchema = z.object({
  content: z.string().default(""),
  label: z.string().default("Notes"),
  showLabel: z.boolean().default(true),
  placeholder: z.string().default("Enter notes..."),
});

export const termsComponentSchema = z.object({
  content: z.string().default(""),
  label: z.string().default("Terms & Conditions"),
  showLabel: z.boolean().default(true),
  placeholder: z.string().default("Enter terms and conditions..."),
});

export const qrCodeComponentSchema = z.object({
  data: z.string().default(""),
  size: z.number().default(128),
  errorCorrectionLevel: z.enum(["L", "M", "Q", "H"]).default("M"),
  includeMargin: z.boolean().default(true),
  label: z.string().optional(),
});

export const paymentButtonComponentSchema = z.object({
  label: z.string().default("Pay Now"),
  url: z.string().url().optional().or(z.literal("")),
  style: z.enum(["primary", "secondary", "outline"]).default("primary"),
  size: z.enum(["sm", "md", "lg"]).default("md"),
  fullWidth: z.boolean().default(false),
});

export const milestoneInfoComponentSchema = z.object({
  fields: z
    .array(
      z.enum(["title", "description", "date", "amount", "status", "progress"])
    )
    .default(["title", "description", "date", "amount", "status"]),
  layout: z.enum(["vertical", "horizontal", "card"]).default("card"),
  showProgressBar: z.boolean().default(true),
});

export const changeOrdersComponentSchema = z.object({
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        width: z.string().optional(),
        format: z.string().optional(),
      })
    )
    .default([
      { key: "number", label: "CO #" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", format: "currency" },
      { key: "status", label: "Status" },
    ]),
  showHeaders: z.boolean().default(true),
  filterStatus: z.array(z.string()).optional(),
});

export const scheduleOfValuesComponentSchema = z.object({
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        width: z.string().optional(),
        format: z.string().optional(),
      })
    )
    .default([
      { key: "lineItem", label: "Line Item" },
      { key: "amount", label: "Amount", format: "currency" },
      { key: "completedPercent", label: "% Complete" },
      { key: "billed", label: "Billed", format: "currency" },
      { key: "remaining", label: "Remaining", format: "currency" },
    ]),
  showHeaders: z.boolean().default(true),
  showTotals: z.boolean().default(true),
  editable: z.boolean().default(false),
});

export const retainageComponentSchema = z.object({
  showRate: z.boolean().default(true),
  showAmount: z.boolean().default(true),
  showReleased: z.boolean().default(true),
  rateLabel: z.string().default("Retainage %"),
  amountLabel: z.string().default("Retainage Amount"),
  releasedLabel: z.string().default("Released"),
});

export const previousPaymentsComponentSchema = z.object({
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        width: z.string().optional(),
        format: z.string().optional(),
      })
    )
    .default([
      { key: "date", label: "Date", format: "date" },
      { key: "amount", label: "Amount", format: "currency" },
      { key: "method", label: "Method" },
      { key: "reference", label: "Reference" },
    ]),
  showHeaders: z.boolean().default(true),
  showTotal: z.boolean().default(true),
});

export const laborTableComponentSchema = z.object({
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        width: z.string().optional(),
        format: z.string().optional(),
      })
    )
    .default([
      { key: "description", label: "Labor Description" },
      { key: "hours", label: "Hours", format: "number" },
      { key: "rate", label: "Rate", format: "currency" },
      { key: "amount", label: "Amount", format: "currency" },
    ]),
  showHeaders: z.boolean().default(true),
  showTotals: z.boolean().default(true),
});

export const materialsTableComponentSchema = z.object({
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        width: z.string().optional(),
        format: z.string().optional(),
      })
    )
    .default([
      { key: "description", label: "Material" },
      { key: "quantity", label: "Qty", format: "number" },
      { key: "unitPrice", label: "Unit Price", format: "currency" },
      { key: "amount", label: "Amount", format: "currency" },
    ]),
  showHeaders: z.boolean().default(true),
  showTotals: z.boolean().default(true),
});

export const equipmentTableComponentSchema = z.object({
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        width: z.string().optional(),
        format: z.string().optional(),
      })
    )
    .default([
      { key: "description", label: "Equipment" },
      { key: "days", label: "Days", format: "number" },
      { key: "rate", label: "Daily Rate", format: "currency" },
      { key: "amount", label: "Amount", format: "currency" },
    ]),
  showHeaders: z.boolean().default(true),
  showTotals: z.boolean().default(true),
});

export const discountsComponentSchema = z.object({
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        width: z.string().optional(),
        format: z.string().optional(),
      })
    )
    .default([
      { key: "type", label: "Type" },
      { key: "value", label: "Value" },
      { key: "amount", label: "Amount", format: "currency" },
    ]),
  showHeaders: z.boolean().default(true),
  showTotal: z.boolean().default(true),
});

export const taxesComponentSchema = z.object({
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        width: z.string().optional(),
        format: z.string().optional(),
      })
    )
    .default([
      { key: "rate", label: "Tax Rate %" },
      { key: "amount", label: "Tax Amount", format: "currency" },
      { key: "taxId", label: "Tax ID" },
    ]),
  showHeaders: z.boolean().default(true),
  showTotal: z.boolean().default(true),
});

export const paymentSummaryComponentSchema = z.object({
  showSubtotal: z.boolean().default(true),
  showDiscount: z.boolean().default(true),
  showTax: z.boolean().default(true),
  showRetainage: z.boolean().default(true),
  showLateFees: z.boolean().default(false),
  showAmountPaid: z.boolean().default(true),
  showBalanceDue: z.boolean().default(true),
  alignment: z.enum(["left", "right"]).default("right"),
  fontSize: z.string().default("10pt"),
  fontWeight: z.enum(["normal", "bold"]).default("bold"),
  labelWidth: z.string().default("150px"),
  valueWidth: z.string().default("120px"),
});

export const sectionSchema = z.object({});
export const rowSchema = z.object({});
export const columnSchema = z.object({
  width: z.string().default("1fr"),
  flexGrow: z.number().default(1),
});

export const componentRegistry: Record<AllComponentType, ComponentSchema> = {
  section: {
    type: "section",
    label: "Section",
    description: "Top-level container for invoice sections",
    icon: "layout",
    category: "layout",
    schema: sectionSchema,
    defaultProps: {},
    defaultStyle: {
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      padding: "16px",
    },
    allowedParents: [],
    allowedChildren: ["row"],
    isLayout: true,
    render: () => null,
  },
  row: {
    type: "row",
    label: "Row",
    description: "Horizontal container for columns",
    icon: "layout",
    category: "layout",
    schema: rowSchema,
    defaultProps: {},
    defaultStyle: {
      display: "flex",
      flexDirection: "row",
      gap: "16px",
      width: "100%",
    },
    allowedParents: ["section"],
    allowedChildren: ["column"],
    isLayout: true,
    render: () => null,
  },
  column: {
    type: "column",
    label: "Column",
    description: "Vertical container for components",
    icon: "layout",
    category: "layout",
    schema: columnSchema,
    defaultProps: { width: "1fr" },
    defaultStyle: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      minWidth: "0",
    },
    allowedParents: ["row"],
    allowedChildren: [
      "text",
      "image",
      "customerInfo",
      "invoiceNumber",
      "date",
      "lineItems",
      "subtotal",
      "tax",
      "discount",
      "paymentTerms",
      "signature",
      "customField",
      "businessInfo",
      "projectInfo",
      "notes",
      "terms",
      "qrCode",
      "paymentButton",
      "milestoneInfo",
      "changeOrders",
      "scheduleOfValues",
      "retainage",
      "previousPayments",
      "laborTable",
      "materialsTable",
      "equipmentTable",
      "discounts",
      "taxes",
      "paymentSummary",
    ],
    isLayout: true,
    render: () => null,
  },
  text: {
    type: "text",
    label: "Text",
    description: "Rich text content block",
    icon: "type",
    category: "content",
    schema: textComponentSchema,
    defaultProps: { content: "Enter text...", format: "plain" },
    defaultStyle: { fontSize: 14, color: "#333", lineHeight: 1.5 },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  image: {
    type: "image",
    label: "Image / Logo",
    description: "Image or logo component",
    icon: "image",
    category: "content",
    schema: imageComponentSchema,
    defaultProps: { alt: "Image", width: "auto", height: "auto", objectFit: "contain" },
    defaultStyle: { maxWidth: "100%", height: "auto" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  customerInfo: {
    type: "customerInfo",
    label: "Customer Info",
    description: "Customer billing/shipping information",
    icon: "user",
    category: "business",
    schema: customerInfoComponentSchema,
    defaultProps: {
      fields: ["name", "address", "email", "phone"],
      layout: "vertical",
      showLabels: true,
      labelWidth: "120px",
    },
    defaultStyle: { fontSize: 12, color: "#333", gap: "4px" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  invoiceNumber: {
    type: "invoiceNumber",
    label: "Invoice Number",
    description: "Auto-generated invoice number",
    icon: "hash",
    category: "business",
    schema: invoiceNumberComponentSchema,
    defaultProps: { prefix: "INV-", format: "{prefix}{year}{sequence:04d}", showLabel: true, label: "Invoice #" },
    defaultStyle: { fontSize: 14, fontWeight: "bold", color: "#333" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  date: {
    type: "date",
    label: "Date",
    description: "Issue date, due date, or custom date",
    icon: "calendar",
    category: "business",
    schema: dateComponentSchema,
    defaultProps: { dateType: "issue", format: "MM/DD/YYYY", showLabel: true, label: "Date" },
    defaultStyle: { fontSize: 14, color: "#333" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  lineItems: {
    type: "lineItems",
    label: "Line Items",
    description: "Itemized list of products/services",
    icon: "list",
    category: "business",
    schema: lineItemsComponentSchema,
    defaultProps: {
      columns: [
        { key: "description", label: "Description", align: "left" },
        { key: "quantity", label: "Qty", align: "center" },
        { key: "unitPrice", label: "Unit Price", align: "right", format: "currency" },
        { key: "total", label: "Total", align: "right", format: "currency" },
      ],
      showLineNumbers: true,
      showHeaders: true,
      stripedRows: false,
      hoverHighlight: true,
      allowAddRows: true,
      allowDeleteRows: true,
      allowReorderRows: true,
      currency: "USD",
      taxColumn: false,
      discountColumn: false,
      multiPage: true,
      emptyStateText: "No line items added",
    },
    defaultStyle: { fontSize: 12, borderColor: "#e5e7eb" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  subtotal: {
    type: "subtotal",
    label: "Subtotal",
    description: "Subtotal amount display",
    icon: "calculator",
    category: "totals",
    schema: subtotalComponentSchema,
    defaultProps: { showLabel: true, label: "Subtotal", alignment: "right", fontWeight: "bold" },
    defaultStyle: { fontSize: 14, fontWeight: "bold", textAlign: "right" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  tax: {
    type: "tax",
    label: "Tax",
    description: "Tax calculation display",
    icon: "percent",
    category: "totals",
    schema: taxComponentSchema,
    defaultProps: { showLabel: true, label: "Tax", showRate: true, alignment: "right", fontWeight: "normal" },
    defaultStyle: { fontSize: 14, textAlign: "right" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  discount: {
    type: "discount",
    label: "Discount",
    description: "Discount amount display",
    icon: "tag",
    category: "totals",
    schema: discountComponentSchema,
    defaultProps: { showLabel: true, label: "Discount", discountType: "percentage", alignment: "right", fontWeight: "normal" },
    defaultStyle: { fontSize: 14, textAlign: "right", color: "#dc2626" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  paymentTerms: {
    type: "paymentTerms",
    label: "Payment Terms",
    description: "Payment terms and conditions",
    icon: "file-text",
    category: "business",
    schema: paymentTermsComponentSchema,
    defaultProps: {
      terms: "Net 30 days",
      dueDateLabel: "Due Date",
      showDueDate: true,
      paymentMethods: [],
      showBankDetails: false,
    },
    defaultStyle: { fontSize: 12, color: "#333", lineHeight: 1.6 },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  signature: {
    type: "signature",
    label: "Signature",
    description: "Digital signature field",
    icon: "pen-tool",
    category: "advanced",
    schema: signatureComponentSchema,
    defaultProps: {
      showSignerName: true,
      showSignerTitle: true,
      showDate: true,
      signatureWidth: "200px",
      signatureHeight: "80px",
      label: "Authorized Signature",
    },
    defaultStyle: { fontSize: 12, color: "#333" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  customField: {
    type: "customField",
    label: "Custom Field",
    description: "Configurable custom input field",
    icon: "settings",
    category: "advanced",
    schema: customFieldComponentSchema,
    defaultProps: { fieldKey: "", label: "Custom Field", fieldType: "text", required: false },
    defaultStyle: { fontSize: 14, color: "#333" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  businessInfo: {
    type: "businessInfo",
    label: "Business Info",
    description: "Company/organization information",
    icon: "building",
    category: "business",
    schema: businessInfoComponentSchema,
    defaultProps: {
      fields: ["logo", "name", "address", "phone", "email"],
      layout: "vertical",
      logoWidth: "120px",
      logoHeight: "auto",
      showLabels: false,
    },
    defaultStyle: { fontSize: 12, color: "#333", gap: "4px" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  projectInfo: {
    type: "projectInfo",
    label: "Project Info",
    description: "Project details and metadata",
    icon: "folder",
    category: "business",
    schema: projectInfoComponentSchema,
    defaultProps: {
      fields: ["name", "number", "address", "manager"],
      layout: "vertical",
      showLabels: true,
    },
    defaultStyle: { fontSize: 12, color: "#333", gap: "4px" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  notes: {
    type: "notes",
    label: "Notes",
    description: "General notes section",
    icon: "sticky-note",
    category: "content",
    schema: notesComponentSchema,
    defaultProps: { content: "", label: "Notes", showLabel: true, placeholder: "Enter notes..." },
    defaultStyle: { fontSize: 12, color: "#333", lineHeight: 1.6 },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  terms: {
    type: "terms",
    label: "Terms & Conditions",
    description: "Legal terms and conditions",
    icon: "shield",
    category: "content",
    schema: termsComponentSchema,
    defaultProps: { content: "", label: "Terms & Conditions", showLabel: true, placeholder: "Enter terms and conditions..." },
    defaultStyle: { fontSize: 11, color: "#666", lineHeight: 1.6 },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  qrCode: {
    type: "qrCode",
    label: "QR Code",
    description: "QR code for payment or data",
    icon: "qr-code",
    category: "advanced",
    schema: qrCodeComponentSchema,
    defaultProps: { data: "", size: 128, errorCorrectionLevel: "M", includeMargin: true },
    defaultStyle: { display: "inline-block" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  paymentButton: {
    type: "paymentButton",
    label: "Payment Button",
    description: "Online payment button",
    icon: "credit-card",
    category: "advanced",
    schema: paymentButtonComponentSchema,
    defaultProps: { label: "Pay Now", style: "primary", size: "md", fullWidth: false },
    defaultStyle: {},
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  milestoneInfo: {
    type: "milestoneInfo",
    label: "Milestone Info",
    description: "Project milestone details",
    icon: "flag",
    category: "business",
    schema: milestoneInfoComponentSchema,
    defaultProps: {
      fields: ["title", "description", "date", "amount", "status"],
      layout: "card",
      showProgressBar: true,
    },
    defaultStyle: { fontSize: 12, color: "#333", gap: "8px", padding: "12px", borderRadius: "8px", borderWidth: "1px", borderColor: "#e5e7eb" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  changeOrders: {
    type: "changeOrders",
    label: "Change Orders",
    description: "Change order listing",
    icon: "git-branch",
    category: "business",
    schema: changeOrdersComponentSchema,
    defaultProps: {
      columns: [
        { key: "number", label: "CO #" },
        { key: "description", label: "Description" },
        { key: "amount", label: "Amount", format: "currency" },
        { key: "status", label: "Status" },
      ],
      showHeaders: true,
    },
    defaultStyle: { fontSize: 12, borderColor: "#e5e7eb" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  scheduleOfValues: {
    type: "scheduleOfValues",
    label: "Schedule of Values",
    description: "AIA-style progress billing schedule",
    icon: "layout",
    category: "business",
    schema: scheduleOfValuesComponentSchema,
    defaultProps: {
      columns: [
        { key: "lineItem", label: "Line Item" },
        { key: "amount", label: "Amount", format: "currency" },
        { key: "completedPercent", label: "% Complete" },
        { key: "billed", label: "Billed", format: "currency" },
        { key: "remaining", label: "Remaining", format: "currency" },
      ],
      showHeaders: true,
      showTotals: true,
      editable: false,
    },
    defaultStyle: { fontSize: 11, borderColor: "#e5e7eb" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  retainage: {
    type: "retainage",
    label: "Retainage",
    description: "Retainage calculation display",
    icon: "lock",
    category: "totals",
    schema: retainageComponentSchema,
    defaultProps: {
      showRate: true,
      showAmount: true,
      showReleased: true,
      rateLabel: "Retainage %",
      amountLabel: "Retainage Amount",
      releasedLabel: "Released",
    },
    defaultStyle: { fontSize: 12, color: "#333", textAlign: "right" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  previousPayments: {
    type: "previousPayments",
    label: "Previous Payments",
    description: "Payment history table",
    icon: "credit-card",
    category: "business",
    schema: previousPaymentsComponentSchema,
    defaultProps: {
      columns: [
        { key: "date", label: "Date", format: "date" },
        { key: "amount", label: "Amount", format: "currency" },
        { key: "method", label: "Method" },
        { key: "reference", label: "Reference" },
      ],
      showHeaders: true,
      showTotal: true,
    },
    defaultStyle: { fontSize: 12, borderColor: "#e5e7eb" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  laborTable: {
    type: "laborTable",
    label: "Labor Table",
    description: "Time & materials labor breakdown",
    icon: "user-clock",
    category: "business",
    schema: laborTableComponentSchema,
    defaultProps: {
      columns: [
        { key: "description", label: "Labor Description" },
        { key: "hours", label: "Hours", format: "number" },
        { key: "rate", label: "Rate", format: "currency" },
        { key: "amount", label: "Amount", format: "currency" },
      ],
      showHeaders: true,
      showTotals: true,
    },
    defaultStyle: { fontSize: 12, borderColor: "#e5e7eb" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  materialsTable: {
    type: "materialsTable",
    label: "Materials Table",
    description: "Time & materials materials breakdown",
    icon: "package",
    category: "business",
    schema: materialsTableComponentSchema,
    defaultProps: {
      columns: [
        { key: "description", label: "Material" },
        { key: "quantity", label: "Qty", format: "number" },
        { key: "unitPrice", label: "Unit Price", format: "currency" },
        { key: "amount", label: "Amount", format: "currency" },
      ],
      showHeaders: true,
      showTotals: true,
    },
    defaultStyle: { fontSize: 12, borderColor: "#e5e7eb" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  equipmentTable: {
    type: "equipmentTable",
    label: "Equipment Table",
    description: "Time & materials equipment breakdown",
    icon: "tool",
    category: "business",
    schema: equipmentTableComponentSchema,
    defaultProps: {
      columns: [
        { key: "description", label: "Equipment" },
        { key: "days", label: "Days", format: "number" },
        { key: "rate", label: "Daily Rate", format: "currency" },
        { key: "amount", label: "Amount", format: "currency" },
      ],
      showHeaders: true,
      showTotals: true,
    },
    defaultStyle: { fontSize: 12, borderColor: "#e5e7eb" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  discounts: {
    type: "discounts",
    label: "Discounts & Fees",
    description: "Itemized discounts and fees",
    icon: "minus-circle",
    category: "totals",
    schema: discountsComponentSchema,
    defaultProps: {
      columns: [
        { key: "type", label: "Type" },
        { key: "value", label: "Value" },
        { key: "amount", label: "Amount", format: "currency" },
      ],
      showHeaders: true,
      showTotal: true,
    },
    defaultStyle: { fontSize: 12, borderColor: "#e5e7eb" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  taxes: {
    type: "taxes",
    label: "Taxes",
    description: "Itemized tax breakdown",
    icon: "percent",
    category: "totals",
    schema: taxesComponentSchema,
    defaultProps: {
      columns: [
        { key: "rate", label: "Tax Rate %" },
        { key: "amount", label: "Tax Amount", format: "currency" },
        { key: "taxId", label: "Tax ID" },
      ],
      showHeaders: true,
      showTotal: true,
    },
    defaultStyle: { fontSize: 12, borderColor: "#e5e7eb" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
  paymentSummary: {
    type: "paymentSummary",
    label: "Payment Summary",
    description: "Complete payment summary with totals",
    icon: "dollar-sign",
    category: "totals",
    schema: paymentSummaryComponentSchema,
    defaultProps: {
      showSubtotal: true,
      showDiscount: true,
      showTax: true,
      showRetainage: true,
      showLateFees: false,
      showAmountPaid: true,
      showBalanceDue: true,
      alignment: "right",
      fontSize: "10pt",
      fontWeight: "bold",
      labelWidth: "150px",
      valueWidth: "120px",
    },
    defaultStyle: { fontSize: 14, fontWeight: "bold", textAlign: "right" },
    allowedParents: ["column"],
    isLayout: false,
    render: () => null,
  },
};

export function getComponentSchema(type: AllComponentType): ComponentSchema | undefined {
  return componentRegistry[type];
}

export function getComponentsByCategory(category: ComponentSchema["category"]): ComponentSchema[] {
  return Object.values(componentRegistry).filter((c) => c.category === category);
}

export function getLayoutComponents(): ComponentSchema[] {
  return Object.values(componentRegistry).filter((c) => c.isLayout);
}

export function getContentComponents(): ComponentSchema[] {
  return Object.values(componentRegistry).filter((c) => !c.isLayout);
}

export function getPaletteCategories() {
  return [
    { key: "layout", label: "Layout", icon: "layout" },
    { key: "business", label: "Business", icon: "building" },
    { key: "content", label: "Content", icon: "file-text" },
    { key: "totals", label: "Totals", icon: "calculator" },
    { key: "advanced", label: "Advanced", icon: "settings" },
  ];
}

export function validateComponentProps(type: AllComponentType, props: Record<string, unknown>): { success: boolean; data?: Record<string, unknown>; error?: z.ZodError } {
  const schema = componentRegistry[type]?.schema;
  if (!schema) return { success: false, error: new z.ZodError([]) };
  const result = schema.safeParse(props);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

export function createComponent(type: AllComponentType, parentId?: string, overrides?: Partial<BaseComponent>): BaseComponent {
  const schema = componentRegistry[type];
  if (!schema) throw new Error(`Unknown component type: ${type}`);

  const id = generateId(type === "section" ? "sec" : type === "row" ? "row" : type === "column" ? "col" : "cmp");

  return {
    id,
    type,
    props: { ...schema.defaultProps, ...overrides?.props },
    style: { ...schema.defaultStyle, ...overrides?.style },
    children: overrides?.children ?? [],
    parentId,
    isLayout: schema.isLayout,
  };
}