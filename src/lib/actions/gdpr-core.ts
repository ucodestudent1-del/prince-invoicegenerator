/**
 * GDPR data-subject workflows — pure core logic (Plan 2.7).
 *
 * The functions here take the acting admin AND all dependencies (db, audit,
 * revalidation) as parameters, rather than importing them from the module
 * graph. This keeps them free of `"use server"`, the `next-auth` import graph,
 * and Vitest `vi.mock` hoisting — they can be unit-tested directly by injecting
 * fakes.
 *
 * `src/lib/actions/gdpr.ts` is the thin server-action wrapper that resolves the
 * actor via `requireOrgAdmin` and injects the real dependencies.
 */

import type { AuditEntry } from "@/lib/audit";
import { withActionError, actionError } from "@/lib/action-errors";
import { isDriftError as driftError } from "@/lib/db-drift";

export type Actor = {
  userId: string;
  orgId: string;
  email: string | null;
  role: string;
};

export type DataSubjectExport = {
  subjectType: "User" | "Customer";
  subjectId: string;
  generatedAt: string;
  generatedBy: string;
  organizationId: string;
  data: Record<string, unknown>;
};

/** Minimal db surface that gdpr-core uses. */
export type Db = {
  user: {
    findFirst: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  session: {
    deleteMany: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
  };
  account: {
    deleteMany: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown>;
  };
  onboardingState: {
    findFirst: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
  };
  customer: {
    findFirst: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  };
  customerAddress: {
    findMany: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
  };
  invoice: {
    findMany: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
  };
  estimate: {
    findMany: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
  };
  estimateItem: { deleteMany: (args: unknown) => Promise<unknown> };
  payment: {
    findMany: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
  };
  recurringInvoiceConfig: {
    updateMany: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
  };
  changeOrder: { updateMany: (args: unknown) => Promise<unknown> };
  project: {
    findMany: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<unknown>;
  };
  portalSession: {
    findMany: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<unknown>;
  };
  timeEntry: { findMany: (args: unknown) => Promise<unknown> };
  auditLog: { findMany: (args: unknown) => Promise<unknown> };
  $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
};

export type AuditFn = (entry: AuditEntry) => Promise<void>;
export type RevalidateFn = (path: string) => Promise<void>;
export type IsMissingColumnErrorFn = (err: unknown) => boolean;
export type IsDriftErrorFn = (err: unknown) => boolean;

export type GDPRDeps = {
  db: Db;
  recordAudit: AuditFn;
  revalidateWithLocale: RevalidateFn;
  isMissingColumnError: IsMissingColumnErrorFn;
  /**
   * Symmetric drift coverage (Plan C2). Defaults to a predicate that
   * considers both missing columns AND missing tables as "tolerate", so the
   * `anonymizeCustomer` flow does not 500 on a not-yet-migrated
   * `portalSession` table.
   */
  isDriftError?: IsDriftErrorFn;
};

/**
 * The acting user must be an OWNER or ADMIN of the target organization.
 * Extracted so both wrapper and callers share one authorization rule.
 */
export function requireActorAdmin(actor: Actor | null): asserts actor is Actor {
  if (!actor) actionError("Not authenticated");
  if (!actor["orgId"]) actionError("No organization");
  if (actor["role"] !== "OWNER" && actor["role"] !== "ADMIN") {
    actionError("Only owners and admins can run data-subject requests.");
  }
}

/** Tolerate tables that a drifted database has not migrated yet. */
async function safely<T>(
  deps: GDPRDeps,
  label: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if ((deps["isDriftError"] ?? driftError)(err)) {
      // logWarn is intentionally not wired here to keep this pure-testable.
      return fallback;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/**
 * Article 15 export for an organization member: their profile, onboarding
 * answers, time entries and the audit events they are the actor of.
 */
export async function exportUserData(
  deps: GDPRDeps,
  actor: Actor,
  userId: string
): Promise<DataSubjectExport> {
  const { db, recordAudit } = deps;
  return withActionError("exportUserData", async () => {
    requireActorAdmin(actor);

    const user = await db["user"]["findFirst"]({
      where: { id: userId, organizationId: actor["orgId"] },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        locale: true,
        role: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    }) as Record<string, unknown> | null;

    if (!user) actionError("User not found in your organization.");

    const onboarding = await safely(
      deps,
      "onboardingState",
      () =>
        db["onboardingState"]["findFirst"]({ where: { userId } }) ??
        Promise["resolve"](null),
      null
    );

    const timeEntries = await safely(
      deps,
      "timeEntries",
      () =>
        db["timeEntry"]["findMany"]({
          where: { userId, orgId: actor["orgId"] },
          orderBy: { startTime: "desc" },
        }),
      [] as unknown[]
    );

    const auditTrail = await safely(
      deps,
      "auditLog",
      () =>
        db["auditLog"]["findMany"]({
          where: { actorId: userId },
          orderBy: { createdAt: "desc" },
          take: 1000,
        }),
      [] as unknown[]
    );

    // Sessions and linked OAuth accounts are described, never exported: tokens
    // are credentials, not personal data the subject is entitled to receive.
    const sessionCount = await safely(
      deps,
      "sessions",
      () => db["session"]["count"]({ where: { userId } }),
      0
    );
    const accounts = await safely(
      deps,
      "accounts",
      () =>
        db["account"]["findMany"]({
          where: { userId },
          select: { provider: true, type: true },
        }),
      [] as unknown[]
    );

    void recordAudit({
      category: "DATA",
      action: "DATA_EXPORTED",
      orgId: actor["orgId"],
      actorId: actor["userId"],
      actorEmail: actor["email"],
      actorRole: actor["role"],
      targetType: "User",
      targetId: userId,
      metadata: { basis: "gdpr-article-15", timeEntries: (timeEntries as unknown[])["length"] },
    });

    return {
      subjectType: "User",
      subjectId: userId,
      generatedAt: new Date()["toISOString"](),
      generatedBy: actor["email"] ?? actor["userId"],
      organizationId: actor["orgId"],
      data: {
        profile: user,
        onboarding,
        timeEntries,
        auditTrail,
        linkedAccounts: accounts,
        activeSessionCount: sessionCount,
      },
    };
  });
}

/**
 * Article 17 erasure for an organization member.
 *
 * The `User` row is retained but stripped: `TimeEntry` and other org records
 * reference it, and cascading them away would delete billable history that the
 * organization is required to keep. Credentials are destroyed and all sessions
 * revoked, so the account can never be used again.
 */
export async function anonymizeUser(
  deps: GDPRDeps,
  actor: Actor,
  userId: string
): Promise<{ success: true }> {
  const { db, recordAudit, revalidateWithLocale } = deps;
  return withActionError("anonymizeUser", async () => {
    requireActorAdmin(actor);

    if (userId === actor["userId"]) {
      actionError("You cannot anonymize your own account. Ask another admin to do it.");
    }

    const user = await db["user"]["findFirst"]({
      where: { id: userId, organizationId: actor["orgId"] },
      select: { id: true, email: true, role: true },
    }) as Record<string, unknown> | null;
    if (!user) actionError("User not found in your organization.");
    if (user["role"] === "OWNER") {
      actionError("Transfer ownership before anonymizing the organization owner.");
    }

    // Deterministic, non-reversible placeholder that keeps the unique email
    // constraint satisfiable without retaining the original address.
    const anonymizedEmail = `anonymized+${userId}@invalid.local`;

    await db["$transaction"](async (tx) => {
      const txRecord = tx as Record<string, any>;
      await txRecord["session"]["deleteMany"]({ where: { userId } });
      await txRecord["account"]["deleteMany"]({ where: { userId } });
      await txRecord["user"]["update"]({
        where: { id: userId },
        data: {
          name: "Anonymized user",
          email: anonymizedEmail,
          emailVerified: null,
          image: null,
          password: null,
          organizationId: null,
        },
        select: { id: true },
      });
    });

    await safely(
      deps,
      "onboardingState",
      () => db["onboardingState"]["deleteMany"]({ where: { userId } }),
      { count: 0 }
    );

    void recordAudit({
      category: "DATA",
      action: "USER_ANONYMIZED",
      orgId: actor["orgId"],
      actorId: actor["userId"],
      actorEmail: actor["email"],
      actorRole: actor["role"],
      targetType: "User",
      targetId: userId,
      metadata: { basis: "gdpr-article-17" },
    });

    void revalidateWithLocale("/dashboard/team");
    return { success: true };
  });
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/**
 * Article 15 export for a customer: their record, addresses, and every document
 * raised against them.
 */
export async function exportCustomerData(
  deps: GDPRDeps,
  actor: Actor,
  customerId: string
): Promise<DataSubjectExport> {
  const { db, recordAudit } = deps;
  return withActionError("exportCustomerData", async () => {
    requireActorAdmin(actor);

    const customer = await db["customer"]["findFirst"]({
      where: { id: customerId, orgId: actor["orgId"] },
    });
    if (!customer) actionError("Customer not found in your organization.");

    // portalPin is a credential, not exportable personal data.
    const { portalPin: _portalPin, ...customerData } = customer as Record<string, unknown>;

    const addresses = await safely(
      deps,
      "customerAddress",
      () => db["customerAddress"]["findMany"]({ where: { customerId, orgId: actor["orgId"] } }),
      [] as unknown[]
    );

    const invoices = await safely(
      deps,
      "invoices",
      () =>
        db["invoice"]["findMany"]({
          where: { customerId, orgId: actor["orgId"] },
          include: { items: true },
          orderBy: { createdAt: "desc" },
        }),
      [] as unknown[]
    );

    const estimates = await safely(
      deps,
      "estimates",
      () =>
        db["estimate"]["findMany"]({
          where: { customerId, orgId: actor["orgId"] },
          include: { items: true },
          orderBy: { createdAt: "desc" },
        }),
      [] as unknown[]
    );

    const projects = await safely(
      deps,
      "projects",
      () => db["project"]["findMany"]({ where: { customerId, orgId: actor["orgId"] } }),
      [] as unknown[]
    );

    const portalSessions = await safely(
      deps,
      "portalSessions",
      () =>
        db["portalSession"]["findMany"]({
          where: { customerId },
          // The token is a credential and is deliberately excluded.
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
            lastAccessedAt: true,
            ipAddress: true,
            userAgent: true,
            revokedAt: true,
          },
        }),
      [] as unknown[]
    );

    // Plan C3: Art. 15 completeness — every individual payment the customer
    // made against this customer is part of the data subject's record. The
    // invoice-level `amountPaid` is a denormalised roll-up; the row-level
    // detail belongs in the export.
    const payments = await safely(
      deps,
      "payments",
      () =>
        db["payment"]["findMany"]({
          where: { invoice: { customerId, orgId: actor["orgId"] } },
          select: {
            id: true,
            amount: true,
            method: true,
            reference: true,
            createdAt: true,
            invoice: { select: { id: true, number: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      [] as unknown[]
    );

    void recordAudit({
      category: "DATA",
      action: "DATA_EXPORTED",
      orgId: actor["orgId"],
      actorId: actor["userId"],
      actorEmail: actor["email"],
      actorRole: actor["role"],
      targetType: "Customer",
      targetId: customerId,
      metadata: {
        basis: "gdpr-article-15",
         invoices: (invoices as unknown[])["length"],
        estimates: (estimates as unknown[])["length"],
        payments: (payments as unknown[])["length"],
      },
    });

    return {
      subjectType: "Customer",
      subjectId: customerId,
      generatedAt: new Date()["toISOString"](),
      generatedBy: actor["email"] ?? actor["userId"],
      organizationId: actor["orgId"],
      data: {
        customer: customerData,
        addresses,
        invoices,
        estimates,
        payments,
        projects,
        portalSessions,
      },
    };
  });
}

/**
 * Article 17 erasure for a customer.
 *
 * Personal identifiers are overwritten and portal access is revoked, while
 * invoices, payments and their totals are preserved: financial records carry
 * statutory retention obligations that override the erasure right
 * (GDPR Art. 17(3)(b)). Use `deleteCustomerData` when no such obligation exists.
 */
export async function anonymizeCustomer(
  deps: GDPRDeps,
  actor: Actor,
  customerId: string
): Promise<{ success: true }> {
  const { db, recordAudit, revalidateWithLocale } = deps;
  return withActionError("anonymizeCustomer", async () => {
    requireActorAdmin(actor);

    const customer = await db["customer"]["findFirst"]({
      where: { id: customerId, orgId: actor["orgId"] },
      select: { id: true },
    });
    if (!customer) actionError("Customer not found in your organization.");

    const label = `Anonymized customer ${customerId["slice"](-6)}`;

    await db["$transaction"](async (tx) => {
      const txRecord = tx as Record<string, any>;
      await txRecord["customerAddress"]["deleteMany"]({ where: { customerId, orgId: actor["orgId"] } });
      await txRecord["customer"]["update"]({
        where: { id: customerId },
        data: {
          name: label,
          company: null,
          // Null rather than a placeholder: the @@unique([orgId, email])
          // constraint would collide across repeated anonymizations.
          email: null,
          phone: null,
          website: null,
          taxId: null,
          address: null,
          notes: null,
          portalAccess: false,
          portalPin: null,
        },
        select: { id: true },
      });
    });

    await safely(
      deps,
      "portalSessions",
      () =>
        db["portalSession"]["updateMany"]({
          where: { customerId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      { count: 0 }
    );

    void recordAudit({
      category: "DATA",
      action: "USER_ANONYMIZED",
      orgId: actor["orgId"],
      actorId: actor["userId"],
      actorEmail: actor["email"],
      actorRole: actor["role"],
      targetType: "Customer",
      targetId: customerId,
      metadata: {
        basis: "gdpr-article-17",
        mode: "anonymize",
      },
    });

    void revalidateWithLocale("/dashboard/customers");
    return { success: true };
  });
}

/**
 * Hard delete of a single customer and every document raised against them
 * (Plan 2.7: per-customer deletion, not just org-level).
 *
 * Destroys financial history — only use where no statutory retention applies.
 * Prefer `anonymizeCustomer`.
 */
export async function deleteCustomerData(
  deps: GDPRDeps,
  actor: Actor,
  customerId: string
): Promise<{ count: number }> {
  const { db, recordAudit, revalidateWithLocale } = deps;
  return withActionError("deleteCustomerData", async () => {
    requireActorAdmin(actor);

    const customer = await db["customer"]["findFirst"]({
      where: { id: customerId, orgId: actor["orgId"] },
      select: { id: true },
    });
    if (!customer) actionError("Customer not found in your organization.");

    const invoices = await db["invoice"]["findMany"]({
      where: { customerId, orgId: actor["orgId"] },
      select: { id: true },
    });
    const invoiceIds = (invoices as Array<{ id: string }>)["map"]((row) => row["id"]);

    const estimates = await db["estimate"]["findMany"]({
      where: { customerId, orgId: actor["orgId"] },
      select: { id: true },
    });
    const estimateIds = (estimates as Array<{ id: string }>)["map"]((row) => row["id"]);

    await db["$transaction"](async (tx) => {
      const txRecord = tx as Record<string, any>;
      if (invoiceIds["length"]) {
        // Clear references first so non-cascading foreign keys cannot block.
        await txRecord["changeOrder"]["updateMany"]({
          where: { orgId: actor["orgId"], invoiceId: { in: invoiceIds } },
          data: { invoiceId: null },
        });
        await txRecord["recurringInvoiceConfig"]["updateMany"]({
          where: { lastInvoiceId: { in: invoiceIds } },
          data: { lastInvoiceId: null },
        });
        await txRecord["invoiceItem"]["deleteMany"]({ where: { invoiceId: { in: invoiceIds } } });
      }
      if (estimateIds["length"]) {
        await txRecord["estimateItem"]["deleteMany"]({ where: { estimateId: { in: estimateIds } } });
      }
      await txRecord["recurringInvoiceConfig"]["deleteMany"]({
        where: { customerId, orgId: actor["orgId"] },
      });
      await txRecord["invoice"]["deleteMany"]({ where: { customerId, orgId: actor["orgId"] } });
      await txRecord["estimate"]["deleteMany"]({ where: { customerId, orgId: actor["orgId"] } });
      await txRecord["project"]["updateMany"]({
        where: { customerId, orgId: actor["orgId"] },
        data: { customerId: null },
      });
      await txRecord["customerAddress"]["deleteMany"]({ where: { customerId, orgId: actor["orgId"] } });
      await txRecord["customer"]["delete"]({ where: { id: customerId }, select: { id: true } });
    });

     void recordAudit({
       category: "DATA",
       action: "CUSTOMER_DATA_DELETED",
       orgId: actor["orgId"],
       actorId: actor["userId"],
       actorEmail: actor["email"],
       actorRole: actor["role"],
       targetType: "Customer",
       targetId: customerId,
       metadata: {
         basis: "gdpr-article-17",
         mode: "hard-delete",
         deletedInvoices: invoiceIds["length"],
         deletedEstimates: estimateIds["length"],
       },
     });

     void revalidateWithLocale("/dashboard/customers");
     return { count: 1 };
   });
}
