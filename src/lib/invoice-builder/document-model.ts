import { z } from "zod";

export type ComponentType =
  | "text"
  | "image"
  | "customerInfo"
  | "invoiceNumber"
  | "date"
  | "lineItems"
  | "subtotal"
  | "tax"
  | "discount"
  | "paymentTerms"
  | "signature"
  | "customField"
  | "businessInfo"
  | "projectInfo"
  | "notes"
  | "terms"
  | "qrCode"
  | "paymentButton"
  | "milestoneInfo"
  | "changeOrders"
  | "scheduleOfValues"
  | "retainage"
  | "previousPayments"
  | "laborTable"
  | "materialsTable"
  | "equipmentTable"
  | "discounts"
  | "taxes"
  | "paymentSummary";

export type LayoutComponentType = "section" | "row" | "column";

export type AllComponentType = ComponentType | LayoutComponentType;

export interface BaseComponent {
  id: string;
  type: AllComponentType;
  props: Record<string, unknown>;
  style: ComponentStyle;
  children?: string[];
  parentId?: string;
  isLayout?: boolean;
}

export interface ComponentStyle {
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  padding?: string;
  margin?: string;
  borderRadius?: string;
  borderWidth?: string;
  borderColor?: string;
  borderStyle?: string;
  textAlign?: "left" | "center" | "right";
  fontFamily?: string;
  lineHeight?: number;
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  maxHeight?: string;
  display?: "block" | "flex" | "grid" | "inline-block";
  flexDirection?: "row" | "column";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  gap?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  overflow?: "visible" | "hidden" | "auto" | "scroll";
  opacity?: number;
  visibility?: "visible" | "hidden" | "collapse";
  pageBreakBefore?: "auto" | "always" | "avoid";
  pageBreakAfter?: "auto" | "always" | "avoid";
  pageBreakInside?: "auto" | "avoid";
}

export interface DocumentModel {
  id: string;
  name: string;
  version: number;
  invoiceType: string;
  components: Map<string, BaseComponent>;
  rootIds: string[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface DragState {
  activeId: string | null;
  activeType: "palette" | "canvas" | null;
  componentType: AllComponentType | null;
  originalParentId: string | null;
  originalIndex: number | null;
  currentTargetId: string | null;
  insertPosition: "before" | "after" | "inside" | null;
  placeholderId: string | null;
}

export interface EditorState {
  document: DocumentModel;
  selectedId: string | null;
  dragState: DragState;
  history: DocumentModel[];
  historyIndex: number;
  isDirty: boolean;
}

export const componentStyleSchema = z.object({
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  padding: z.string().optional(),
  margin: z.string().optional(),
  borderRadius: z.string().optional(),
  borderWidth: z.string().optional(),
  borderColor: z.string().optional(),
  borderStyle: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  fontFamily: z.string().optional(),
  lineHeight: z.number().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
  minWidth: z.string().optional(),
  minHeight: z.string().optional(),
  maxWidth: z.string().optional(),
  maxHeight: z.string().optional(),
  display: z.enum(["block", "flex", "grid", "inline-block"]).optional(),
  flexDirection: z.enum(["row", "column"]).optional(),
  justifyContent: z.enum(["flex-start", "center", "flex-end", "space-between", "space-around"]).optional(),
  alignItems: z.enum(["flex-start", "center", "flex-end", "stretch"]).optional(),
  gap: z.string().optional(),
  gridTemplateColumns: z.string().optional(),
  gridTemplateRows: z.string().optional(),
  overflow: z.enum(["visible", "hidden", "auto", "scroll"]).optional(),
  opacity: z.number().optional(),
  visibility: z.enum(["visible", "hidden", "collapse"]).optional(),
  pageBreakBefore: z.enum(["auto", "always", "avoid"]).optional(),
  pageBreakAfter: z.enum(["auto", "always", "avoid"]).optional(),
  pageBreakInside: z.enum(["auto", "avoid"]).optional(),
});

export type ComponentStyleInput = z.infer<typeof componentStyleSchema>;

export const baseComponentSchema = z.object({
  id: z.string(),
  type: z.string(),
  props: z.record(z.unknown()),
  style: componentStyleSchema.optional().default({}),
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  isLayout: z.boolean().optional(),
});

export type BaseComponentInput = z.infer<typeof baseComponentSchema>;

export const documentModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number(),
  invoiceType: z.string(),
  components: z.record(baseComponentSchema),
  rootIds: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.record(z.unknown()).optional(),
});

export type DocumentModelInput = z.infer<typeof documentModelSchema>;

export function generateId(prefix = "cmp"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyDocument(name: string, invoiceType: string): DocumentModel {
  const now = new Date();
  return {
    id: generateId("doc"),
    name,
    version: 1,
    invoiceType,
    components: new Map(),
    rootIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createSectionComponent(id: string, parentId?: string): BaseComponent {
  return {
    id,
    type: "section",
    props: {},
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      padding: "16px",
    },
    children: [],
    parentId,
    isLayout: true,
  };
}

export function createRowComponent(id: string, parentId?: string): BaseComponent {
  return {
    id,
    type: "row",
    props: {},
    style: {
      display: "flex",
      flexDirection: "row",
      gap: "16px",
      width: "100%",
    },
    children: [],
    parentId,
    isLayout: true,
  };
}

export function createColumnComponent(id: string, parentId?: string, width = "1fr"): BaseComponent {
  return {
    id,
    type: "column",
    props: { width },
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      minWidth: "0",
    },
    children: [],
    parentId,
    isLayout: true,
  };
}