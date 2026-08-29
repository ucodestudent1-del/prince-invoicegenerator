"use server";

import { addMonths, addDays, addWeeks, addYears } from "date-fns";
import { db, withRetry } from "@/lib/db";
import { requireUser, isMissingColumnError, getActivePlan } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { getNextInvoiceNumber } from "@/lib/numbering";
import { revalidateWithLocale } from "@/lib/revalidate";
import { hasFeature } from "@/lib/plans";
import { stripe } from "@/lib/stripe";
import { logError } from "@/lib/logging";

export interface RecurringConfigInput {
  customerId: string;
  projectId?: string | null;
  frequency: string;
  startDate: string;
  taxRate: number;
  discount: number;
  notes?: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
  endDate?: string | null;
  occurrences?: number | null;
  paymentTerms?: string;
  autoSend?: boolean;
  autoCharge?: boolean;
}

const FREQUENCY_MAP: Record<string, (d: Date, n: number) => Date> = {
  WEEKLY: (d, n) => addWeeks(d, n),
  BIWEEKLY: (d, n) => addWeeks(d, n * 2),
  MONTHLY: (d, n) => addMonths(d, n),
  QUARTERLY: (d, n) => addMonths(d, n * 3),
  SEMIANNUAL: (d, n) => addMonths(d, n * 6),
  ANNUAL: (d, n) => addYears(d, n),
};

// Days to add to the issue date for each payment term. DUE_ON_RECEIPT is net 0.
const PAYMENT_TERMS_OFFSET: Record<string, number> = {
  DUE_ON_RECEIPT: 0,
  NET_7: 7,
  NET_15: 15,
  NET_30: 30,
  NET_60: 60,
};

interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
}

function resolveDueDate(issueDate: Date, terms?: string | null): Date {
  const key = (terms ?? "NET_30")["toUpperCase"]();
  const offset = PAYMENT_TERMS_OFFSET[key];
  return offset == null ? addMonths(issueDate, 1) : addDays(issueDate, offset);
}

// A series is exhausted once it has reached its date limit or issued the
// configured number of invoices (checked against the count BEFORE generating).
function isRecurrenceExhausted(
  endDate: Date | null,
  occurrences: number | null,
  generatedCount: number,
  now: Date
): boolean {
  if (endDate && now["getTime"]() >= endDate["getTime"]()) return true;
  if (occurrences && generatedCount >= occurrences) return true;
  return false;
}

function normalizeDefaultItems(json: unknown): InvoiceItemInput[] {
  if (!Array["isArray"](json)) return [];
  return json
    ["map"]((it: any) => {
      const quantity = Number(it["quantity"]) ?? 0;
      const unitPrice = Number(it["unitPrice"]) ?? 0;
      const amount = Number(it["amount"]) ?? quantity * unitPrice;
      return {
        description: String(it["description"] ?? ""),
        quantity,
        unitPrice,
        amount,
        sortOrder: Number(it["sortOrder"]) ?? 0,
      };
    })
    ["filter"]((it) => it["description"] && it["quantity"] > 0 && it["unitPrice"] > 0);
}

function normalizeTemplateItems(items: any[]): InvoiceItemInput[] {
  return (items ?? [])["map"]((it) => ({
    description: it["description"],
    quantity: Number(it["quantity"]),
    unitPrice: Number(it["unitPrice"]),
    amount: Number(it["amount"]),
    sortOrder: Number(it["sortOrder"] ?? 0),
  }));
}

// Recompute invoice totals from the chosen items/rates (used when the config
// supplies its own default tax rate / discount / items).
function computeTotals(
  items: InvoiceItemInput[],
  taxRate: number,
  discount: number,
  retainageRate: number
) {
  const subtotal = items["reduce"]((sum, i) => sum + (Number(i["amount"]) || 0), 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const totalBeforeRetainage = subtotal + taxAmount - discount;
  const retainageAmount = (totalBeforeRetainage * retainageRate) / 100;
  const total = totalBeforeRetainage - retainageAmount;
  return { subtotal, taxAmount, total, retainageAmount };
}

async function logAudit(
  orgId: string,
  invoiceId: string,
  action: string,
  toStatus: string | null,
  note?: string,
  userId?: string | null
) {
  try {
    await db["invoiceAudit"]["create"]({
      data: {
        orgId,
        invoiceId,
        action,
        fromStatus: null,
        toStatus,
        note,
        createdById: userId ?? null,
      },
    });
  } catch (err: any) {
    if (!isMissingColumnError(err)) throw err;
  }
}

// Persist the generated invoice. Centralizes the original create + its
// schema-drift fallback (omit billToAddress/shipToAddress/createdById when the
// columns are absent) and the unique-number retry loop.
interface CreateInvoiceParams {
  orgId: string;
  userId: string | null;
  configId: string;
  number: string;
  issueDate: Date;
  dueDate: Date;
  status: "DRAFT" | "SENT";
  customerId: string;
  projectId: string | null | undefined;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  retainageRate: number;
  retainageAmount: number;
  total: number;
  notes: string | null | undefined;
  logoUrl: string | null | undefined;
  billToAddress: string | null | undefined;
  shipToAddress: string | null | undefined;
  items: InvoiceItemInput[];
}

async function createRecurringInvoiceEntry(p: CreateInvoiceParams): Promise<any> {
  let number = p["number"];
  const baseData = () => ({
    orgId: p["orgId"],
    number,
    customerId: p["customerId"],
    projectId: p["projectId"] ?? null,
    type: "RECURRING" as const,
    status: p["status"],
    issueDate: p["issueDate"],
    dueDate: p["dueDate"],
    currency: "USD",
    subtotal: p["subtotal"],
    taxRate: p["taxRate"],
    taxAmount: p["taxAmount"],
    discount: p["discount"],
    retainageRate: p["retainageRate"],
    retainageAmount: p["retainageAmount"],
    total: p["total"],
    amountPaid: 0,
    notes: p["notes"],
    logoUrl: p["logoUrl"],
    recurringConfigId: p["configId"],
    ...(p["userId"] ? { createdById: p["userId"] } : {}),
    items: {
      create: p["items"]["map"]((i) => ({
        description: i["description"],
        quantity: i["quantity"],
        unitPrice: i["unitPrice"],
        amount: i["amount"],
        sortOrder: i["sortOrder"],
      })),
    },
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await db["invoice"]["create"]({ data: baseData() });
    } catch (err: any) {
      if (isMissingColumnError(err)) {
        // Schema drift: billToAddress / shipToAddress / createdById may not exist.
        const drift: any = baseData();
        delete drift["billToAddress"];
        delete drift["shipToAddress"];
        delete drift["createdById"];
        return await db["invoice"]["create"]({ data: drift });
      }
      if (
        err instanceof Error &&
        err["message"]["includes"]("Unique constraint failed") &&
        attempt < 3
      ) {
        number = await getNextInvoiceNumber(db, p["orgId"]);
        continue;
      }
      throw err;
    }
  }
  actionError("Failed to create invoice after 3 attempts.");
}

async function validateTemplateInvoice(
  config: { lastInvoiceId: string | null; orgId: string }
) {
  if (!config["lastInvoiceId"]) {
    actionError("No template invoice linked to this recurring config. Link an invoice first.");
  }

  let template: any;
  try {
    template = await db["invoice"]["findFirst"]({
      where: { id: config["lastInvoiceId"]!, orgId: config["orgId"] },
      include: { items: true },
    });
  } catch (err) {
    if (isMissingColumnError(err)) {
      template = await db["invoice"]["findFirst"]({
        where: { id: config["lastInvoiceId"]!, orgId: config["orgId"] },
        select: {
          id: true,
          number: true,
          type: true,
          status: true,
          issueDate: true,
          dueDate: true,
          currency: true,
          subtotal: true,
          taxRate: true,
          taxAmount: true,
          discount: true,
          retainageRate: true,
          retainageAmount: true,
          total: true,
          amountPaid: true,
          notes: true,
          recurringConfigId: true,
          createdById: true,
          items: { orderBy: { sortOrder: "asc" } },
        },
      });
    } else {
      throw err;
    }
  }

  if (!template) {
    actionError(
      "Template invoice not found. It may have been deleted. Link a new invoice to this recurring config."
    );
  }

  return template!;
}

// Best-effort Stripe charge. NEVER throws out of the generator: on any failure
// (no Stripe customer, declined payment, API error, non-Business plan) it logs
// an audit row and leaves the invoice at its current status.
async function chargeRecurringInvoice(
  org: GenOrg | null,
  invoice: { id: string; number: string; total: number; currency?: string },
  totals: {
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    items: InvoiceItemInput[];
    currency?: string;
  }
): Promise<void> {
  if (!org?.["stripeCustomerId"]) return;
  try {
    if (!hasFeature(org["plan"], "autoCharge")) return;

    const currency = (totals["currency"] ?? invoice["currency"] ?? "USD")["toLowerCase"]();

    for (const i of totals["items"]) {
      await stripe["invoiceItems"]["create"]({
        customer: org["stripeCustomerId"]!,
        amount: Math["round"](Number(i["unitPrice"] || 0) * 100),
        currency,
        description: String(i["description"] ?? "Recurring charge"),
        quantity: Number(i["quantity"] || 1),
      });
    }

    const stripeInvoice = await stripe["invoices"]["create"]({
      customer: org["stripeCustomerId"]!,
      auto_advance: true,
      collection_method: "charge_automatically",
      description: `Recurring invoice ${invoice["number"]}`,
    });

    await stripe["invoices"]["finalizeInvoice"](stripeInvoice["id"]);
    await stripe["invoices"]["pay"](stripeInvoice["id"]);

    await db["payment"]["create"]({
      data: {
        invoiceId: invoice["id"],
        orgId: org["id"],
        amount: totals["total"],
        method: "STRIPE",
        status: "COMPLETED",
        stripePaymentId: stripeInvoice["id"],
        note: `Auto-charged recurring invoice ${invoice["number"]}`,
      },
    });

    await db["invoice"]["update"]({
      where: { id: invoice["id"], orgId: org!["id"] },
      data: {
        status: "PAID",
        amountPaid: totals["total"],
        stripeInvoiceId: stripeInvoice["id"],
      },
    });
  } catch (err: any) {
    // Best-effort: record the failure and move on — never block generation.
    try {
      await db["invoiceAudit"]["create"]({
        data: {
          orgId: org!["id"],
          invoiceId: invoice["id"],
          action: "AUTO_CHARGE_FAILED",
          fromStatus: null,
          toStatus: null,
          note: `autoCharge failed: ${err?.["message"] ?? String(err)}`,
        },
      });
    } catch (auditErr) {
      logError("Failed to write auto-charge audit log", auditErr);
    }
  }
}

interface GenOrg {
  id: string;
  stripeCustomerId?: string | null;
  plan?: any;
}

// Core: generate one invoice for a recurring config. Shared by the manual
// ("Generate now") path and the automation cron. Returns the invoice row (or
// null + reason when the series is paused/done/before-start).
async function generateRecurringInvoice(ctx: {
  orgId: string;
  userId: string | null;
  org: GenOrg | null;
  config: any;
  now: Date;
}): Promise<{ invoice: any | null; error?: string }> {
  const { orgId, userId, org, config, now } = ctx;

  const autoSend = config["autoSend"] ?? true;
  const autoCharge = config["autoCharge"] === true;
  const paymentTerms = config["paymentTerms"] ?? "NET_30";
  const startDate = config["startDate"] ? new Date(config["startDate"]) : null;
  const endDate = config["endDate"] ? new Date(config["endDate"]) : null;
  const occurrences = config["occurrences"] ? Number(config["occurrences"]) : null;
  const generatedCount = config["generatedCount"] ? Number(config["generatedCount"]) : 0;
  const frequency = (config["frequency"] ?? "MONTHLY")["toUpperCase"]();
  const addFn = FREQUENCY_MAP[frequency] || ((d: Date) => addMonths(d, 1));

  // 1) start gate — the series hasn't begun yet.
  if (startDate && now["getTime"]() < startDate["getTime"]()) {
    return { invoice: null, error: "not_started" };
  }

  // 2) exhaustion gate — the series is already finished.
  if (isRecurrenceExhausted(endDate, occurrences, generatedCount, now)) {
    await db["recurringInvoiceConfig"]["update"]({
      where: { id: config["id"], orgId },
      data: { active: false },
    });
    return { invoice: null, error: "completed" };
  }

  const hasDefaultItems =
    Array["isArray"](config["defaultItems"]) && config["defaultItems"]["length"] > 0;
  const hasDefaultTax = config["defaultTaxRate"] != null;
  const hasDefaultDiscount = config["defaultDiscount"] != null;
  const hasDefaults = hasDefaultItems || hasDefaultTax || hasDefaultDiscount;

  // Default items let a config generate without a linked template invoice.
  let template: any = null;
  if (!hasDefaultItems) {
    template = await validateTemplateInvoice(config); // throws if no template linked
  }

  const items: InvoiceItemInput[] = hasDefaultItems
    ? normalizeDefaultItems(config["defaultItems"])
    : normalizeTemplateItems(template!["items"] ?? []);

  const taxRate = hasDefaultTax ? Number(config["defaultTaxRate"]) : template?.["taxRate"] ?? 0;
  const discount = hasDefaultDiscount ? Number(config["defaultDiscount"]) : template?.["discount"] ?? 0;
  const retainageRate = template?.["retainageRate"] ?? 0;

  let subtotal: number, taxAmount: number, total: number, retainageAmount: number;
  if (hasDefaults) {
    const t = computeTotals(items, taxRate, discount, retainageRate);
    subtotal = t["subtotal"];
    taxAmount = t["taxAmount"];
    total = t["total"];
    retainageAmount = t["retainageAmount"];
  } else {
    // No config-level overrides: copy the template's precomputed totals
    // verbatim (identical to the historical behavior).
    subtotal = template!["subtotal"];
    taxAmount = template!["taxAmount"];
    total = template!["total"];
    retainageAmount = template!["retainageAmount"];
  }

  const issueDate = now;
  const dueDate = resolveDueDate(issueDate, paymentTerms);
  const status: "DRAFT" | "SENT" = autoSend ? "SENT" : "DRAFT";
  const number = await getNextInvoiceNumber(db, orgId);

  const invoice = await createRecurringInvoiceEntry({
    orgId,
    userId,
    configId: config["id"],
    number,
    issueDate,
    dueDate,
    status,
    customerId: config["customerId"],
    projectId: (config as any)["projectId"] ?? null,
    subtotal,
    taxRate,
    taxAmount,
    discount,
    retainageRate,
    retainageAmount,
    total,
    notes: template?.["notes"] ?? null,
    logoUrl: template?.["logoUrl"] ?? null,
    billToAddress: template?.["billToAddress"] ?? null,
    shipToAddress: template?.["shipToAddress"] ?? null,
    items,
  });

  await logAudit(
    orgId,
    invoice["id"],
    "RECURRING_INVOICE_GENERATED",
    status,
    `Generated from recurring config ${config["id"]}`,
    userId
  );

  if (autoCharge && org?.["stripeCustomerId"] && hasFeature(org["plan"], "autoCharge")) {
    await chargeRecurringInvoice(org, invoice, {
      subtotal,
      taxRate,
      taxAmount,
      total,
      items,
      currency: invoice["currency"],
    });
  }

  const newCount = generatedCount + 1;
  const advance: any = {
    lastInvoiceId: invoice["id"],
    generatedCount: { increment: 1 },
    nextRunDate: addFn(now, 1),
  };
  const shouldDeactivate = isRecurrenceExhausted(endDate, occurrences, newCount, now);
  if (shouldDeactivate) {
    advance["active"] = false;
  }

  // Advance the series. Fall back to the legacy columns only if the DB hasn't
  // been migrated to the new schema yet (schema-drift tolerance).
  try {
    await db["recurringInvoiceConfig"]["update"]({
      where: { id: config["id"], orgId },
      data: advance,
    });
  } catch (err: any) {
    if (isMissingColumnError(err)) {
      const legacy: any = {
        lastInvoiceId: invoice["id"],
        nextRunDate: addFn(now, 1),
      };
      if (shouldDeactivate) legacy["active"] = false;
      await db["recurringInvoiceConfig"]["update"]({
        where: { id: config["id"], orgId },
        data: legacy,
      });
    } else {
      throw err;
    }
  }

  await revalidateWithLocale("/dashboard/invoices");
  await revalidateWithLocale("/dashboard/recurring");
  await revalidateWithLocale("/dashboard");

  return { invoice };
}

export async function createRecurringConfig(input: RecurringConfigInput) {
  return withActionError("createRecurringConfig", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const plan = await getActivePlan(user);
    if (!hasFeature(plan, "recurring")) actionError("Recurring invoices require a paid plan. Upgrade to unlock this feature.");

    const customerExists = await withRetry(() =>
      db["customer"]["findFirst"]({
        where: { id: input["customerId"], orgId },
        select: { id: true },
      })
    );
    if (!customerExists) actionError("Customer not found.");

    if (input["projectId"]) {
      const projectExists = await withRetry(() =>
        db["project"]["findFirst"]({
          where: { id: input["projectId"]!, orgId },
          select: { id: true },
        })
      );
      if (!projectExists) actionError("Project not found.");
    }

    const validItems = input["items"]["filter"](
      (it) => it["description"] && it["quantity"] > 0 && it["unitPrice"] > 0
    );
    if (validItems["length"] === 0) {
      actionError("At least one line item is required.");
    }

    const startDate = new Date(input["startDate"]);
    const frequency = input["frequency"]["toUpperCase"]();
    const nextRunDate = FREQUENCY_MAP[frequency]
      ? FREQUENCY_MAP[frequency](startDate, 1)
      : addMonths(startDate, 1);

    // Map the form's taxRate/discount/items onto the new default columns.
    // A zero value is treated as "not set" (-> use the template on generation).
    const fullData = {
      orgId,
      customerId: input["customerId"],
      projectId: input["projectId"] ?? null,
      frequency,
      nextRunDate,
      active: true,
      generatedCount: 0,
      startDate: input["startDate"] ? new Date(input["startDate"]) : null,
      endDate: input["endDate"] ? new Date(input["endDate"]) : null,
      occurrences: input["occurrences"] ?? null,
      paymentTerms: input["paymentTerms"] ?? "NET_30",
      autoSend: input["autoSend"] ?? true,
      autoCharge: input["autoCharge"] ?? false,
      defaultTaxRate: input["taxRate"] ? Number(input["taxRate"]) : null,
      defaultDiscount: input["discount"] ? Number(input["discount"]) : null,
      defaultItems:
        validItems["length"] > 0 ? validItems : undefined,
    };

    let config;
    try {
      config = await db["recurringInvoiceConfig"]["create"]({ data: fullData });
    } catch (err) {
      if (isMissingColumnError(err)) {
        // New columns (and possibly projectId) may not exist on this DB yet.
        config = await db["recurringInvoiceConfig"]["create"]({
          data: {
            orgId,
            customerId: input["customerId"],
            frequency,
            nextRunDate,
            active: true,
          },
        });
      } else {
        throw err;
      }
    }

    await revalidateWithLocale("/dashboard/recurring");
    return config;
  });
}

export async function getRecurringConfigs() {
  return withActionError("getRecurringConfigs", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    let configs;
    try {
      configs = await db["recurringInvoiceConfig"]["findMany"]({
        where: { orgId },
        include: {
          customer: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (err) {
      // Fallback: select only columns that definitely exist in the database
      if (isMissingColumnError(err)) {
        configs = await db["recurringInvoiceConfig"]["findMany"]({
          where: { orgId },
          select: {
            id: true,
            orgId: true,
            customerId: true,
            frequency: true,
            nextRunDate: true,
            active: true,
            lastInvoiceId: true,
            createdAt: true,
            updatedAt: true,
            customer: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        });
      } else {
        throw err;
      }
    }

    const configIds = configs["map"]((c) => c["lastInvoiceId"])["filter"](Boolean) as string[];
    const invoices: Record<string, any> = {};
    if (configIds["length"] > 0) {
      try {
        const lastInvoices = await db["invoice"]["findMany"]({
          where: { id: { in: configIds } },
          select: { id: true, number: true, status: true, total: true, issueDate: true },
        });
        for (const inv of lastInvoices) {
          invoices[inv["id"]] = inv;
        }
      } catch (err) {
        if (isMissingColumnError(err)) {
          const fallbackInvoices = await db["invoice"]["findMany"]({
            where: { id: { in: configIds } },
            select: { id: true, number: true, status: true, total: true },
          });
          for (const inv of fallbackInvoices) {
            invoices[inv["id"]] = inv;
          }
        } else {
          throw err;
        }
      }
    }

    return configs["map"]((c) => ({
      ...c,
      lastInvoice: c["lastInvoiceId"] ? invoices[c["lastInvoiceId"]] : null,
    }));
  });
}

export async function toggleRecurringConfig(id: string, active: boolean) {
  return withActionError("toggleRecurringConfig", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    const plan = await getActivePlan(user);
    if (!hasFeature(plan, "recurring")) actionError("Recurring invoices require a paid plan. Upgrade to unlock this feature.");

    await db["recurringInvoiceConfig"]["update"]({
      where: { id, orgId: user["organizationId"] },
      data: { active },
    });

    await revalidateWithLocale("/dashboard/recurring");
  });
}

export async function getRecurringConfig(id: string) {
  return withActionError("getRecurringConfig", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    let config;
    try {
      config = await db["recurringInvoiceConfig"]["findFirst"]({
        where: { id, orgId },
        include: {
          customer: true,
          project: { select: { name: true } },
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        config = await db["recurringInvoiceConfig"]["findFirst"]({
          where: { id, orgId },
          select: {
            id: true,
            orgId: true,
            customerId: true,
            frequency: true,
            nextRunDate: true,
            active: true,
            lastInvoiceId: true,
            createdAt: true,
            updatedAt: true,
            customer: { select: { id: true, name: true, email: true, company: true } },
          },
        });
      } else {
        throw err;
      }
    }

    if (!config) actionError("Recurring config not found.");

    let lastInvoice = null;
    if (config["lastInvoiceId"]) {
      lastInvoice = await db["invoice"]["findFirst"]({
        where: { id: config["lastInvoiceId"], orgId },
        select: { id: true, number: true, status: true, total: true, issueDate: true },
      });
    }

    return { ...config, lastInvoice };
  });
}

export async function generateNextInvoice(configId: string) {
  return withActionError("generateNextInvoice", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const plan = await getActivePlan(user);
    if (!hasFeature(plan, "recurring")) actionError("Recurring invoices require a paid plan. Upgrade to unlock this feature.");

    let config;
    try {
      config = await db["recurringInvoiceConfig"]["findFirst"]({
        where: { id: configId, orgId },
        include: { customer: true },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        config = await db["recurringInvoiceConfig"]["findFirst"]({
          where: { id: configId, orgId },
          select: {
            id: true,
            orgId: true,
            customerId: true,
            frequency: true,
            nextRunDate: true,
            active: true,
            lastInvoiceId: true,
            createdAt: true,
            updatedAt: true,
            customer: { select: { name: true, email: true, company: true, address: true } },
          },
        });
      } else {
        throw err;
      }
    }
    if (!config) actionError("Recurring config not found.");

    let org: GenOrg | null = null;
    try {
      org = await db["organization"]["findFirst"]({
        where: { id: orgId },
        select: { id: true, plan: true, stripeCustomerId: true },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        org = await db["organization"]["findFirst"]({
          where: { id: orgId },
          select: { id: true },
        });
      } else {
        throw err;
      }
    }

    const { invoice } = await generateRecurringInvoice({
      orgId,
      userId: user["id"],
      org,
      config,
      now: new Date(),
    });
    return invoice;
  });
}

export async function processRecurringInvoices() {
  return withActionError("processRecurringInvoices", async () => {
    let orgs;
    try {
      orgs = await db["organization"]["findMany"]({
        select: {
          id: true,
          plan: true,
          stripeCustomerId: true,
          recurringConfigs: { where: { active: true } },
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        orgs = await db["organization"]["findMany"]({
          select: {
            id: true,
            recurringConfigs: { where: { active: true } },
          },
        });
      } else {
        throw err;
      }
    }

    const results: { configId: string; invoiceId: string | null; error?: string }[] = [];
    const now = new Date();

    for (const org of orgs) {
      const orgPlan = (org as any)["plan"];
      if (orgPlan && !hasFeature(orgPlan, "recurring")) continue;
      for (const config of org["recurringConfigs"]) {
        if (now["getTime"]() < new Date(config["nextRunDate"])["getTime"]()) continue;

        try {
          const { invoice, error } = await generateRecurringInvoice({
            orgId: org["id"],
            userId: null,
            org,
            config,
            now,
          });
          if (invoice) {
            results["push"]({ configId: config["id"], invoiceId: invoice["id"] });
          } else {
            results["push"]({ configId: config["id"], invoiceId: null, error: error ?? "skipped" });
          }
        } catch (err: any) {
          results["push"]({ configId: config["id"], invoiceId: null, error: err["message"] });
        }
      }
    }

    return results;
  });
}

export async function linkInvoiceToRecurring(invoiceId: string, configId: string) {
  return withActionError("linkInvoiceToRecurring", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    const plan = await getActivePlan(user);
    if (!hasFeature(plan, "recurring")) actionError("Recurring invoices require a paid plan. Upgrade to unlock this feature.");

    try {
      await db["invoice"]["update"]({
        where: { id: invoiceId, orgId: user["organizationId"] },
        data: { recurringConfigId: configId },
        select: { id: true },
      });

      await db["recurringInvoiceConfig"]["update"]({
        where: { id: configId, orgId: user["organizationId"] },
        data: { lastInvoiceId: invoiceId },
        select: { id: true },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        actionError("Recurring invoice linking is not available on your current database schema. Please run pending migrations.");
      }
      throw err;
    }

    await revalidateWithLocale("/dashboard/recurring");
  });
}

export async function processScheduledInvoices() {
  return withActionError("processScheduledInvoices", async () => {
    const now = new Date();
    let scheduled: any[];
    try {
      scheduled = await db["invoice"]["findMany"]({
        where: {
          scheduledFor: { lte: now },
          status: "DRAFT",
        },
        include: { items: true },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        scheduled = [];
      } else {
        throw err;
      }
    }

    const results: { id: string; number: string; error?: boolean }[] = [];

    for (const inv of scheduled) {
      let failed = false;
      try {
        try {
          await db["invoice"]["update"]({
            where: { id: inv["id"] },
            data: {
              scheduledFor: null,
              status: "SENT",
            },
          });
        } catch (err) {
          if (isMissingColumnError(err)) {
            try {
              await db["invoice"]["update"]({
                where: { id: inv["id"] },
                data: {
                  status: "SENT",
                },
              });
            } catch (retryErr) {
              failed = true;
            }
          } else {
            failed = true;
          }
        }

        if (!failed) {
          try {
            await db["invoiceAudit"]["create"]({
              data: {
                invoiceId: inv["id"],
                orgId: inv["orgId"],
                action: "SCHEDULED_INVOICE_SENT",
                fromStatus: "DRAFT",
                toStatus: "SENT",
                note: "Automatically sent from scheduled queue",
              },
            });
          } catch (err) {
            if (!isMissingColumnError(err)) {
              failed = true;
            }
          }
        }
      } catch (err) {
        failed = true;
      }

      results["push"]({ id: inv["id"], number: inv["number"], error: failed });
    }

    return results;
  });
}

export async function scheduleInvoice(invoiceId: string, scheduledFor: string) {
  return withActionError("scheduleInvoice", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    try {
      await db["invoice"]["update"]({
        where: { id: invoiceId, orgId: user["organizationId"] },
        data: {
          scheduledFor: new Date(scheduledFor),
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        actionError("The scheduled invoice feature is not available on your current database schema. Please run pending migrations.");
      }
      throw err;
    }

    await revalidateWithLocale("/dashboard/invoices");
  });
}
