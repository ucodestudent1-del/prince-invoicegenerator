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
  | "prioritySupport";

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  priceLabel: string;
  priceMonthly?: number;
  blurb: string;
  audience: string;
  features: FeatureKey[];
  stripePriceId?: string;
  stripePriceIdYearly?: string;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "FREE",
    name: "Free",
    priceLabel: "$0",
    priceMonthly: 0,
    blurb: "Trying the platform",
    audience: "New contractors getting started",
    features: ["invoicesPerMonth", "branding", "customerDb"],
  },
  {
    id: "STARTER",
    name: "Starter",
    priceLabel: "$15–25",
    priceMonthly: 19,
    blurb: "Solo contractors",
    audience: "Solo contractors",
    features: [
      "invoicesPerMonth",
      "branding",
      "estimates",
      "customerDb",
    ],
    stripePriceId: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
  },
  {
    id: "PRO",
    name: "Pro",
    priceLabel: "$39–59",
    priceMonthly: 49,
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
    ],
    stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
  },
  {
    id: "BUSINESS",
    name: "Business",
    priceLabel: "$79–149",
    priceMonthly: 99,
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
      "multipleUsers",
      "projectManagement",
      "subcontractorTracking",
      "reports",
    ],
    stripePriceId: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    priceLabel: "Custom",
    blurb: "Large firms",
    audience: "Large firms",
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
      "multipleUsers",
      "projectManagement",
      "subcontractorTracking",
      "reports",
      "apiAccess",
      "customIntegrations",
      "prioritySupport",
    ],
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
};

// Human-friendly allowance text per plan for the "invoicesPerMonth" feature.
export const INVOICE_LIMITS: Record<SubscriptionPlan, number | null> = {
  FREE: 5,
  STARTER: null, // unlimited
  PRO: null,
  BUSINESS: null,
  ENTERPRISE: null,
};

export function getPlan(id: SubscriptionPlan): PlanDefinition {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function hasFeature(plan: SubscriptionPlan, feature: FeatureKey) {
  return getPlan(plan).features.includes(feature);
}
