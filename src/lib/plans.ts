import type { SubscriptionPlan } from "@prisma/client";

export type FeatureKey =
  | "invoicesPerMonth"
  | "branding"
  | "estimates"
  | "customerDb"
  | "progressInvoices"
  | "changeOrders"
  | "retainage"
  | "recurring"
  | "expenseTracking"
  | "photoAttachments"
  | "multipleUsers"
  | "projectManagement"
  | "subcontractorTracking"
  | "reports"
  | "apiAccess"
  | "customIntegrations"
  | "prioritySupport"
  | "savedAddresses"
  | "invoiceTemplates"
  | "darkMode"
  | "customBranding"
  | "customFonts"
  | "multipleLayouts"
  | "automaticReminders"
  | "lateFees"
  | "scheduledInvoices"
  | "pdfExport";

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  priceLabel: string;
  priceMonthly?: number;
  blurb: string;
  audience: string;
  features: FeatureKey[];
  stripePriceId?: string;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "FREE",
    name: "Free",
    priceLabel: "$0",
    priceMonthly: 0,
    blurb: "Trying the platform",
    audience: "New contractors getting started",
    features: ["invoicesPerMonth", "branding", "customerDb", "savedAddresses"],
  },
  {
    id: "STARTER",
    name: "Starter",
    priceLabel: "$20/mo",
    priceMonthly: 20,
    blurb: "Solo contractors",
    audience: "Solo contractors",
    features: [
      "invoicesPerMonth",
      "branding",
      "estimates",
      "customerDb",
      "progressInvoices",
      "recurring",
      "savedAddresses",
      "invoiceTemplates",
      "customBranding",
    ],
    stripePriceId: process.env.STRIPE_PRICE_STARTER_MONTHLY,
  },
  {
    id: "PRO",
    name: "Pro",
    priceLabel: "$45/mo",
    priceMonthly: 45,
    blurb: "Small construction companies",
    audience: "Small construction companies",
    features: [
      "invoicesPerMonth",
      "branding",
      "estimates",
      "customerDb",
      "progressInvoices",
      "changeOrders",
      "retainage",
      "recurring",
      "expenseTracking",
      "photoAttachments",
      "savedAddresses",
      "darkMode",
      "invoiceTemplates",
      "customBranding",
      "pdfExport",
    ],
    stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY,
  },
  {
    id: "BUSINESS",
    name: "Business",
    priceLabel: "$130/mo",
    priceMonthly: 130,
    blurb: "Growing contractors",
    audience: "Growing contractors",
    features: [
      "invoicesPerMonth",
      "branding",
      "estimates",
      "customerDb",
      "progressInvoices",
      "changeOrders",
      "retainage",
      "recurring",
      "expenseTracking",
      "photoAttachments",
      "savedAddresses",
      "darkMode",
      "invoiceTemplates",
      "customBranding",
      "customFonts",
      "multipleLayouts",
      "multipleUsers",
      "projectManagement",
      "subcontractorTracking",
      "reports",
      "automaticReminders",
      "lateFees",
      "scheduledInvoices",
      "pdfExport",
    ],
    stripePriceId: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
  },
];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  invoicesPerMonth: "Monthly invoice allowance",
  branding: "Custom branding",
  estimates: "Estimates / quotes",
  customerDb: "Customer database",
  progressInvoices: "Progress (AIA-style) invoices",
  changeOrders: "Change orders",
  retainage: "Retainage tracking",
  recurring: "Recurring invoices",
  expenseTracking: "Expense tracking",
  photoAttachments: "Photo attachments",
  multipleUsers: "Multiple team users",
  projectManagement: "Project management",
  subcontractorTracking: "Subcontractor tracking",
  reports: "Reports & analytics",
  apiAccess: "API access",
  customIntegrations: "Custom integrations",
  prioritySupport: "Priority support",
  savedAddresses: "Saved customer addresses",
  invoiceTemplates: "Multiple invoice templates",
  darkMode: "Dark / light mode",
  customBranding: "Custom brand colors",
  customFonts: "Custom fonts",
  multipleLayouts: "Multiple page layouts",
  automaticReminders: "Automatic due-date reminders",
  lateFees: "Automatic late fee calculation",
  scheduledInvoices: "Scheduled invoices",
  pdfExport: "PDF export without watermark",
};

// Human-friendly allowance text per plan for the "invoicesPerMonth" feature.
export const INVOICE_LIMITS: Record<SubscriptionPlan, number | null> = {
  FREE: 5,
  STARTER: 50,
  PRO: 500,
  BUSINESS: null,
  ENTERPRISE: null,
};

export function getPlan(id: SubscriptionPlan): PlanDefinition {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function hasFeature(plan: SubscriptionPlan, feature: FeatureKey): boolean {
  if (process.env.NEXT_PUBLIC_UNLOCK_ALL_FEATURES === "true") {
    return true;
  }
  const planDef = getPlan(plan);
  return planDef.features.includes(feature);
}
