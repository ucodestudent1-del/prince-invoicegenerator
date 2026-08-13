"use server";

import { addMonths, addDays, addWeeks, addYears } from "date-fns";
import { db, withRetry } from "@/lib/db";
import { requireUser, isMissingColumnError } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { getNextInvoiceNumber } from "@/lib/numbering";
import { revalidateWithLocale } from "@/lib/revalidate";

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
}

const FREQUENCY_MAP: Record<string, (d: Date, n: number) => Date> = {
  WEEKLY: (d, n) => addWeeks(d, n),
  BIWEEKLY: (d, n) => addWeeks(d, n * 2),
  MONTHLY: (d, n) => addMonths(d, n),
  QUARTERLY: (d, n) => addMonths(d, n * 3),
  SEMIANNUAL: (d, n) => addMonths(d, n * 6),
  ANNUAL: (d, n) => addYears(d, n),
};

async function validateTemplateInvoice(
  config: { lastInvoiceId: string | null; orgId: string }
) {
  if (!config.lastInvoiceId) {
    actionError("No template invoice linked to this recurring config. Link an invoice first.");
  }

  const template = await db.invoice.findFirst({
    where: { id: config.lastInvoiceId!, orgId: config.orgId },
    include: { items: true },
  });

  if (!template) {
    actionError(
      "Template invoice not found. It may have been deleted. Link a new invoice to this recurring config."
    );
  }

  return template!;
}

export async function createRecurringConfig(input: RecurringConfigInput) {
  return withActionError("createRecurringConfig", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    const customerExists = await withRetry(() =>
      db.customer.findFirst({
        where: { id: input.customerId, orgId },
        select: { id: true },
      })
    );
    if (!customerExists) actionError("Customer not found.");

    if (input.projectId) {
      const projectExists = await withRetry(() =>
        db.project.findFirst({
          where: { id: input.projectId!, orgId },
          select: { id: true },
        })
      );
      if (!projectExists) actionError("Project not found.");
    }

    const validItems = input.items.filter(
      (it) => it.description && it.quantity > 0 && it.unitPrice > 0
    );
    if (validItems.length === 0) {
      actionError("At least one line item is required.");
    }

    const startDate = new Date(input.startDate);
    const frequency = input.frequency.toUpperCase();
    const nextRunDate = FREQUENCY_MAP[frequency] ? FREQUENCY_MAP[frequency](startDate, 1) : addMonths(startDate, 1);

    let config;
    try {
      config = await db.recurringInvoiceConfig.create({
        data: {
          orgId,
          customerId: input.customerId,
          projectId: input.projectId ?? null,
          frequency,
          nextRunDate,
          active: true,
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        // projectId column may not exist — retry without it
        config = await db.recurringInvoiceConfig.create({
          data: {
            orgId,
            customerId: input.customerId,
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
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    let configs;
    try {
      configs = await db.recurringInvoiceConfig.findMany({
        where: { orgId },
        include: {
          customer: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (err) {
      // Fallback: select only columns that definitely exist in the database
      if (isMissingColumnError(err)) {
        configs = await db.recurringInvoiceConfig.findMany({
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

    const configIds = configs.map((c) => c.lastInvoiceId).filter(Boolean) as string[];
    const invoices: Record<string, any> = {};
    if (configIds.length > 0) {
      const lastInvoices = await db.invoice.findMany({
        where: { id: { in: configIds } },
        select: { id: true, number: true, status: true, total: true, issueDate: true },
      });
      for (const inv of lastInvoices) {
        invoices[inv.id] = inv;
      }
    }

    return configs.map((c) => ({
      ...c,
      lastInvoice: c.lastInvoiceId ? invoices[c.lastInvoiceId] : null,
    }));
  });
}

export async function toggleRecurringConfig(id: string, active: boolean) {
  return withActionError("toggleRecurringConfig", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    await db.recurringInvoiceConfig.update({
      where: { id, orgId: user.organizationId },
      data: { active },
    });

    await revalidateWithLocale("/dashboard/recurring");
  });
}

export async function getRecurringConfig(id: string) {
  return withActionError("getRecurringConfig", async () => {
    let user;
    try {
      user = await requireUser();
    } catch {
      return;
    }
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    let config;
    try {
      config = await db.recurringInvoiceConfig.findFirst({
        where: { id, orgId },
        include: {
          customer: true,
          project: { select: { name: true } },
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        config = await db.recurringInvoiceConfig.findFirst({
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
            customer: true,
          },
        });
      } else {
        throw err;
      }
    }

    if (!config) actionError("Recurring config not found.");

    let lastInvoice = null;
    if (config.lastInvoiceId) {
      lastInvoice = await db.invoice.findFirst({
        where: { id: config.lastInvoiceId, orgId },
        select: { id: true, number: true, status: true, total: true, issueDate: true },
      });
    }

    return { ...config, lastInvoice };
  });
}

export async function generateNextInvoice(configId: string) {
  return withActionError("generateNextInvoice", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");
    const orgId = user.organizationId;

    let config;
    try {
      config = await db.recurringInvoiceConfig.findFirst({
        where: { id: configId, orgId },
        include: { customer: true },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        config = await db.recurringInvoiceConfig.findFirst({
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

    const template = await validateTemplateInvoice(config);

    const number = await getNextInvoiceNumber(db, orgId);

    const issueDate = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = config.frequency === "WEEKLY"
      ? addDays(today, 7)
      : addMonths(today, 1);

    let invoice;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        invoice = await db.invoice.create({
          data: {
            orgId,
            number,
            customerId: config.customerId,
            projectId: (config as any).projectId ?? null,
            type: "RECURRING",
            status: "DRAFT",
            issueDate,
            dueDate,
            currency: "USD",
            subtotal: template.subtotal,
            taxRate: template.taxRate,
            taxAmount: template.taxAmount,
            discount: template.discount,
            retainageRate: template.retainageRate,
            retainageAmount: template.retainageAmount,
            total: template.total,
            amountPaid: 0,
            notes: template.notes,
            logoUrl: template.logoUrl,
            billToAddress: template.billToAddress,
            shipToAddress: template.shipToAddress,
            recurringConfigId: configId,
            createdById: user.id,
            items: {
              create: template.items.map((it) => ({
                description: it.description,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                amount: it.amount,
                sortOrder: it.sortOrder,
              })),
            },
          },
        });
        break;
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.includes("Unique constraint failed") &&
          attempt < 3
        ) {
          const newNumber = await getNextInvoiceNumber(db, orgId);
          invoice = await db.invoice.create({
            data: {
              orgId,
              number: newNumber,
              customerId: config.customerId,
              projectId: (config as any).projectId ?? null,
              type: "RECURRING",
              status: "DRAFT",
              issueDate,
              dueDate,
              currency: "USD",
              subtotal: template.subtotal,
              taxRate: template.taxRate,
              taxAmount: template.taxAmount,
              discount: template.discount,
              retainageRate: template.retainageRate,
              retainageAmount: template.retainageAmount,
              total: template.total,
              amountPaid: 0,
              notes: template.notes,
              logoUrl: template.logoUrl,
              billToAddress: template.billToAddress,
              shipToAddress: template.shipToAddress,
              recurringConfigId: configId,
              createdById: user.id,
              items: {
                create: template.items.map((it) => ({
                  description: it.description,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice,
                  amount: it.amount,
                  sortOrder: it.sortOrder,
                })),
              },
            },
          });
          break;
        }
        throw err;
      }
    }

    if (!invoice) actionError("Failed to create invoice after 3 attempts.");

    const frequency = config.frequency;
    const addFn = FREQUENCY_MAP[frequency] || (() => addMonths(new Date(), 1));
    const nextRunDate = addFn(new Date(), 1);

    await db.recurringInvoiceConfig.update({
      where: { id: configId },
      data: {
        lastInvoiceId: invoice.id,
        nextRunDate,
      },
    });

    await db.invoiceAudit.create({
      data: {
        invoiceId: invoice.id,
        orgId,
        action: "RECURRING_INVOICE_GENERATED",
        fromStatus: null,
        toStatus: "DRAFT",
        note: `Generated from recurring config ${configId}`,
        createdById: user.id,
      },
    });

    await revalidateWithLocale("/dashboard/invoices");
    await revalidateWithLocale("/dashboard/recurring");
    await revalidateWithLocale("/dashboard");
    return invoice;
  });
}

export async function processRecurringInvoices() {
  return withActionError("processRecurringInvoices", async () => {
    let orgs;
    try {
      orgs = await db.organization.findMany({
        include: { recurringConfigs: { where: { active: true } } },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        orgs = await db.organization.findMany({
          select: {
            id: true,
            recurringConfigs: {
              where: { active: true },
            },
          },
        });
      } else {
        throw err;
      }
    }

    const results: { configId: string; invoiceId: string | null; error?: string }[] = [];

    for (const org of orgs) {
      for (const config of org.recurringConfigs) {
        if (new Date() < config.nextRunDate) continue;

        try {
          const template = config.lastInvoiceId
            ? await db.invoice.findFirst({
                where: { id: config.lastInvoiceId, orgId: org.id },
                include: { items: true },
              })
            : null;

          if (!template) {
            results.push({ configId: config.id, invoiceId: null, error: "No template invoice found or template was deleted." });
            continue;
          }

          let number = await getNextInvoiceNumber(db, org.id);

          const issueDate = new Date();
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dueDate = config.frequency === "WEEKLY"
            ? addDays(today, 7)
            : addMonths(today, 1);

          let invoice;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              invoice = await db.invoice.create({
                data: {
                  orgId: org.id,
                  number,
                  customerId: config.customerId,
                  projectId: (config as any).projectId ?? null,
                  type: "RECURRING",
                  status: "DRAFT",
                  issueDate,
                  dueDate,
                  currency: "USD",
                  subtotal: template.subtotal,
                  taxRate: template.taxRate,
                  taxAmount: template.taxAmount,
                  discount: template.discount,
                  retainageRate: template.retainageRate,
                  retainageAmount: template.retainageAmount,
                  total: template.total,
                  amountPaid: 0,
                  notes: template.notes,
                  logoUrl: template.logoUrl,
                  billToAddress: template.billToAddress,
                  shipToAddress: template.shipToAddress,
                  recurringConfigId: config.id,
                  items: {
                    create: template.items.map((it) => ({
                      description: it.description,
                      quantity: it.quantity,
                      unitPrice: it.unitPrice,
                      amount: it.amount,
                      sortOrder: it.sortOrder,
                    })),
                  },
                },
              });
              break;
            } catch (err) {
              if (
                err instanceof Error &&
                err.message.includes("Unique constraint failed") &&
                attempt < 3
              ) {
                number = await getNextInvoiceNumber(db, org.id);
                continue;
              }
              if (isMissingColumnError(err)) {
                // Schema drift: billToAddress, shipToAddress may not exist
                invoice = await db.invoice.create({
                  data: {
                    orgId: org.id,
                    number,
                    customerId: config.customerId,
                    projectId: (config as any).projectId ?? null,
                    type: "RECURRING",
                    status: "DRAFT",
                    issueDate,
                    dueDate,
                    currency: "USD",
                    subtotal: template.subtotal,
                    taxRate: template.taxRate,
                    taxAmount: template.taxAmount,
                    discount: template.discount,
                    retainageRate: template.retainageRate,
                    retainageAmount: template.retainageAmount,
                    total: template.total,
                    amountPaid: 0,
                    notes: template.notes,
                    logoUrl: template.logoUrl,
                    recurringConfigId: config.id,
                    items: {
                      create: template.items.map((it) => ({
                        description: it.description,
                        quantity: it.quantity,
                        unitPrice: it.unitPrice,
                        amount: it.amount,
                        sortOrder: it.sortOrder,
                      })),
                    },
                  },
                });
                break;
              }
              throw err;
            }
          }

          if (!invoice) {
            results.push({ configId: config.id, invoiceId: null, error: "Failed to create invoice after 3 attempts." });
            continue;
          }

          const addFn = FREQUENCY_MAP[config.frequency] || (() => addMonths(new Date(), 1));
          const nextRunDate = addFn(new Date(), 1);

          await db.recurringInvoiceConfig.update({
            where: { id: config.id },
            data: {
              lastInvoiceId: invoice.id,
              nextRunDate,
            },
          });

          results.push({ configId: config.id, invoiceId: invoice.id });
        } catch (err: any) {
          results.push({ configId: config.id, invoiceId: null, error: err.message });
        }
      }
    }

    return results;
  });
}

export async function linkInvoiceToRecurring(invoiceId: string, configId: string) {
  return withActionError("linkInvoiceToRecurring", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    await db.invoice.update({
      where: { id: invoiceId, orgId: user.organizationId },
      data: { recurringConfigId: configId },
    });

    await db.recurringInvoiceConfig.update({
      where: { id: configId, orgId: user.organizationId },
      data: { lastInvoiceId: invoiceId },
    });

    await revalidateWithLocale("/dashboard/recurring");
  });
}

export async function processScheduledInvoices() {
  return withActionError("processScheduledInvoices", async () => {
    const now = new Date();
    const scheduled = await db.invoice.findMany({
      where: {
        scheduledFor: { lte: now },
        status: "DRAFT",
      },
      include: { items: true },
    });

    const results: { id: string; number: string }[] = [];

    for (const inv of scheduled) {
      await db.invoice.update({
        where: { id: inv.id },
        data: {
          scheduledFor: null,
          status: "SENT",
        },
      });

      await db.invoiceAudit.create({
        data: {
          invoiceId: inv.id,
          orgId: inv.orgId,
          action: "SCHEDULED_INVOICE_SENT",
          fromStatus: "DRAFT",
          toStatus: "SENT",
          note: "Automatically sent from scheduled queue",
        },
      });

      results.push({ id: inv.id, number: inv.number });
    }

    return results;
  });
}

export async function scheduleInvoice(invoiceId: string, scheduledFor: string) {
  return withActionError("scheduleInvoice", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    await db.invoice.update({
      where: { id: invoiceId, orgId: user.organizationId },
      data: {
        scheduledFor: new Date(scheduledFor),
      },
    });

    await revalidateWithLocale("/dashboard/invoices");
  });
}
