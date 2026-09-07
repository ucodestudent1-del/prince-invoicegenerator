import type { InvoiceType } from "@prisma/client";

export interface InvoiceTemplateConfig {
  id: InvoiceType;
  label: string;
  description: string;
  sections: {
    details: boolean;
    billTo: boolean;
    shipTo: boolean;
    lineItems: boolean;
    tax: boolean;
    discount: boolean;
    retainage: boolean;
    notes: boolean;
    milestones: boolean;
    changeOrders: boolean;
    progressSummary: boolean;
  };
  defaults: {
    taxRate: number;
    discount: number;
    retainageRate: number;
    billingIntent: "DEPOSIT" | "PROGRESS" | "FINAL" | "CUSTOM" | null;
  };
  features: {
    requiresProject: boolean;
    supportsRetainage: boolean;
    supportsMilestones: boolean;
    supportsChangeOrders: boolean;
    supportsTimeTracking: boolean;
    supportsCatalog: boolean;
  };
  suggestions: {
    depositPercent?: number;
    fillRemaining?: boolean;
    suggestTimeEntries?: boolean;
    retainageRate?: number;
  };
}

export const INVOICE_TEMPLATES: Record<InvoiceType, InvoiceTemplateConfig> = {
  STANDARD: {
    id: "STANDARD",
    label: "Standard",
    description: "A simple invoice for one-time services or materials.",
    sections: {
      details: true,
      billTo: true,
      shipTo: true,
      lineItems: true,
      tax: true,
      discount: true,
      retainage: false,
      notes: true,
      milestones: false,
      changeOrders: false,
      progressSummary: false,
    },
    defaults: {
      taxRate: 0,
      discount: 0,
      retainageRate: 0,
      billingIntent: null,
    },
    features: {
      requiresProject: false,
      supportsRetainage: false,
      supportsMilestones: false,
      supportsChangeOrders: false,
      supportsTimeTracking: true,
      supportsCatalog: true,
    },
    suggestions: {},
  },
  FIXED_PRICE: {
    id: "FIXED_PRICE",
    label: "Fixed Price",
    description: "A lump-sum invoice for a defined scope of work.",
    sections: {
      details: true,
      billTo: true,
      shipTo: true,
      lineItems: true,
      tax: true,
      discount: true,
      retainage: true,
      notes: true,
      milestones: false,
      changeOrders: true,
      progressSummary: true,
    },
    defaults: {
      taxRate: 0,
      discount: 0,
      retainageRate: 5,
      billingIntent: "PROGRESS",
    },
    features: {
      requiresProject: true,
      supportsRetainage: true,
      supportsMilestones: false,
      supportsChangeOrders: true,
      supportsTimeTracking: false,
      supportsCatalog: true,
    },
    suggestions: {
      retainageRate: 5,
    },
  },
  TIME_AND_MATERIALS: {
    id: "TIME_AND_MATERIALS",
    label: "Time & Materials",
    description: "Invoice based on actual hours worked and materials used.",
    sections: {
      details: true,
      billTo: true,
      shipTo: true,
      lineItems: true,
      tax: true,
      discount: true,
      retainage: false,
      notes: true,
      milestones: false,
      changeOrders: false,
      progressSummary: false,
    },
    defaults: {
      taxRate: 0,
      discount: 0,
      retainageRate: 0,
      billingIntent: null,
    },
    features: {
      requiresProject: true,
      supportsRetainage: false,
      supportsMilestones: false,
      supportsChangeOrders: false,
      supportsTimeTracking: true,
      supportsCatalog: true,
    },
    suggestions: {
      suggestTimeEntries: true,
    },
  },
  PROGRESS: {
    id: "PROGRESS",
    label: "Progress Billing",
    description: "Billing based on percentage of work completed (AIA-style).",
    sections: {
      details: true,
      billTo: true,
      shipTo: true,
      lineItems: true,
      tax: true,
      discount: true,
      retainage: true,
      notes: true,
      milestones: true,
      changeOrders: true,
      progressSummary: true,
    },
    defaults: {
      taxRate: 0,
      discount: 0,
      retainageRate: 10,
      billingIntent: "PROGRESS",
    },
    features: {
      requiresProject: true,
      supportsRetainage: true,
      supportsMilestones: true,
      supportsChangeOrders: true,
      supportsTimeTracking: true,
      supportsCatalog: true,
    },
    suggestions: {
      retainageRate: 10,
    },
  },
  MILESTONE: {
    id: "MILESTONE",
    label: "Milestone",
    description: "Invoice tied to a specific project milestone or phase.",
    sections: {
      details: true,
      billTo: true,
      shipTo: true,
      lineItems: true,
      tax: true,
      discount: true,
      retainage: true,
      notes: true,
      milestones: true,
      changeOrders: false,
      progressSummary: true,
    },
    defaults: {
      taxRate: 0,
      discount: 0,
      retainageRate: 5,
      billingIntent: "PROGRESS",
    },
    features: {
      requiresProject: true,
      supportsRetainage: true,
      supportsMilestones: true,
      supportsChangeOrders: false,
      supportsTimeTracking: true,
      supportsCatalog: true,
    },
    suggestions: {
      retainageRate: 5,
    },
  },
  CHANGE_ORDER: {
    id: "CHANGE_ORDER",
    label: "Change Order",
    description: "Invoice for a scope change or contract modification.",
    sections: {
      details: true,
      billTo: true,
      shipTo: true,
      lineItems: true,
      tax: true,
      discount: true,
      retainage: true,
      notes: true,
      milestones: false,
      changeOrders: true,
      progressSummary: true,
    },
    defaults: {
      taxRate: 0,
      discount: 0,
      retainageRate: 0,
      billingIntent: "CUSTOM",
    },
    features: {
      requiresProject: true,
      supportsRetainage: true,
      supportsMilestones: false,
      supportsChangeOrders: true,
      supportsTimeTracking: false,
      supportsCatalog: true,
    },
    suggestions: {},
  },
  DEPOSIT: {
    id: "DEPOSIT",
    label: "Deposit",
    description: "Upfront payment before work begins.",
    sections: {
      details: true,
      billTo: true,
      shipTo: true,
      lineItems: true,
      tax: true,
      discount: false,
      retainage: false,
      notes: true,
      milestones: false,
      changeOrders: false,
      progressSummary: false,
    },
    defaults: {
      taxRate: 0,
      discount: 0,
      retainageRate: 0,
      billingIntent: "DEPOSIT",
    },
    features: {
      requiresProject: true,
      supportsRetainage: false,
      supportsMilestones: false,
      supportsChangeOrders: false,
      supportsTimeTracking: false,
      supportsCatalog: false,
    },
    suggestions: {
      depositPercent: 10,
    },
  },
  RETAINAGE: {
    id: "RETAINAGE",
    label: "Retainage",
    description: "Release of withheld retainage upon milestone completion.",
    sections: {
      details: true,
      billTo: true,
      shipTo: true,
      lineItems: true,
      tax: false,
      discount: false,
      retainage: true,
      notes: true,
      milestones: true,
      changeOrders: false,
      progressSummary: true,
    },
    defaults: {
      taxRate: 0,
      discount: 0,
      retainageRate: 0,
      billingIntent: "PROGRESS",
    },
    features: {
      requiresProject: true,
      supportsRetainage: true,
      supportsMilestones: true,
      supportsChangeOrders: false,
      supportsTimeTracking: false,
      supportsCatalog: false,
    },
    suggestions: {
      retainageRate: 0,
    },
  },
  FINAL: {
    id: "FINAL",
    label: "Final",
    description: "The last invoice covering the remaining contract balance.",
    sections: {
      details: true,
      billTo: true,
      shipTo: true,
      lineItems: true,
      tax: true,
      discount: true,
      retainage: true,
      notes: true,
      milestones: false,
      changeOrders: true,
      progressSummary: true,
    },
    defaults: {
      taxRate: 0,
      discount: 0,
      retainageRate: 0,
      billingIntent: "FINAL",
    },
    features: {
      requiresProject: true,
      supportsRetainage: true,
      supportsMilestones: false,
      supportsChangeOrders: true,
      supportsTimeTracking: false,
      supportsCatalog: true,
    },
    suggestions: {
      fillRemaining: true,
    },
  },
  RECURRING: {
    id: "RECURRING",
    label: "Recurring",
    description: "Repeating invoice on a fixed schedule.",
    sections: {
      details: true,
      billTo: true,
      shipTo: true,
      lineItems: true,
      tax: true,
      discount: true,
      retainage: false,
      notes: true,
      milestones: false,
      changeOrders: false,
      progressSummary: false,
    },
    defaults: {
      taxRate: 0,
      discount: 0,
      retainageRate: 0,
      billingIntent: null,
    },
    features: {
      requiresProject: false,
      supportsRetainage: false,
      supportsMilestones: false,
      supportsChangeOrders: false,
      supportsTimeTracking: true,
      supportsCatalog: true,
    },
    suggestions: {},
  },
  EXPENSE: {
    id: "EXPENSE",
    label: "Expense",
    description: "Invoice for reimbursable expenses.",
    sections: {
      details: true,
      billTo: true,
      shipTo: true,
      lineItems: true,
      tax: true,
      discount: false,
      retainage: false,
      notes: true,
      milestones: false,
      changeOrders: false,
      progressSummary: false,
    },
    defaults: {
      taxRate: 0,
      discount: 0,
      retainageRate: 0,
      billingIntent: null,
    },
    features: {
      requiresProject: false,
      supportsRetainage: false,
      supportsMilestones: false,
      supportsChangeOrders: false,
      supportsTimeTracking: false,
      supportsCatalog: false,
    },
    suggestions: {},
  },
  CUSTOM: {
    id: "CUSTOM",
    label: "Custom",
    description: "Fully customizable invoice with all sections available.",
    sections: {
      details: true,
      billTo: true,
      shipTo: true,
      lineItems: true,
      tax: true,
      discount: true,
      retainage: true,
      notes: true,
      milestones: true,
      changeOrders: true,
      progressSummary: true,
    },
    defaults: {
      taxRate: 0,
      discount: 0,
      retainageRate: 0,
      billingIntent: null,
    },
    features: {
      requiresProject: false,
      supportsRetainage: true,
      supportsMilestones: true,
      supportsChangeOrders: true,
      supportsTimeTracking: true,
      supportsCatalog: true,
    },
    suggestions: {},
  },
};

export function getInvoiceTemplate(type: InvoiceType): InvoiceTemplateConfig {
  return INVOICE_TEMPLATES[type] ?? INVOICE_TEMPLATES["STANDARD"];
}

export function getAvailableInvoiceTypes(
  canProgress: boolean,
  canRecurring: boolean,
  canRetainage: boolean
): InvoiceType[] {
  const base: InvoiceType[] = [
    "STANDARD",
    "FIXED_PRICE",
    "TIME_AND_MATERIALS",
    "DEPOSIT",
    "FINAL",
    "CUSTOM",
  ];
  if (canProgress) {
    base.push("PROGRESS" as InvoiceType, "MILESTONE" as InvoiceType);
  }
  if (canRetainage) {
    base.push("RETAINAGE" as InvoiceType);
  }
  if (canRecurring) {
    base.push("RECURRING" as InvoiceType);
  }
  base.push("EXPENSE" as InvoiceType);
  return base;
}
