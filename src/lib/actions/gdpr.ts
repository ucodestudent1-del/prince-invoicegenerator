"use server";

/**
 * GDPR data-subject workflows (Plan 2.7).
 *
 * This file is the server-action wrapper. It resolves the acting admin from the
 * session and forwards to the pure, testable core in `./gdpr-core.ts`.
 *
 * See `gdpr-core.ts` for the full policy notes:
 *   - Users (org members) and Customers each support Article 15 export and
 *     Article 17 erasure (via anonymization, preserving financial history).
 *   - Every operation is restricted to OWNER/ADMIN, wrapped in `withActionError`
 *     and written to the audit trail.
 *
 * Audit entries themselves are intentionally not erased. Retaining them rests on
 * GDPR Art. 17(3)(b) and (e) — legal obligation and defence of legal claims.
 */

import { requireUser, isMissingColumnError } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { revalidateWithLocale } from "@/lib/revalidate";

import {
  Actor,
  DataSubjectExport,
  Db,
  GDPRDeps,
  requireActorAdmin,
  exportUserData as exportUserDataCore,
  anonymizeUser as anonymizeUserCore,
  exportCustomerData as exportCustomerDataCore,
  anonymizeCustomer as anonymizeCustomerCore,
  deleteCustomerData as deleteCustomerDataCore,
} from "./gdpr-core";

// Re-export types so existing imports (`DataSubjectExport`) keep working.
export type { Actor, DataSubjectExport };

async function requireOrgAdmin(): Promise<Actor> {
  const user = await requireUser();
  const orgId = user["organizationId"];
  if (typeof orgId !== "string") actionError("No organization");
  const actor: Actor = {
    userId: user["id"],
    orgId,
    email: user["email"] ?? null,
    role: user["role"],
  };
  requireActorAdmin(actor);
  return actor;
}

const deps: GDPRDeps = {
  db: db as unknown as Db,
  recordAudit,
  revalidateWithLocale,
  isMissingColumnError,
};

export async function exportUserData(userId: string): Promise<DataSubjectExport> {
  return withActionError("exportUserData", async () => {
    const actor = await requireOrgAdmin();
    return exportUserDataCore(deps, actor, userId);
  });
}

export async function anonymizeUser(userId: string): Promise<{ success: true }> {
  return withActionError("anonymizeUser", async () => {
    const actor = await requireOrgAdmin();
    return anonymizeUserCore(deps, actor, userId);
  });
}

export async function exportCustomerData(
  customerId: string
): Promise<DataSubjectExport> {
  return withActionError("exportCustomerData", async () => {
    const actor = await requireOrgAdmin();
    return exportCustomerDataCore(deps, actor, customerId);
  });
}

export async function anonymizeCustomer(
  customerId: string
): Promise<{ success: true }> {
  return withActionError("anonymizeCustomer", async () => {
    const actor = await requireOrgAdmin();
    return anonymizeCustomerCore(deps, actor, customerId);
  });
}

export async function deleteCustomerData(customerId: string): Promise<{ count: number }> {
  return withActionError("deleteCustomerData", async () => {
    const actor = await requireOrgAdmin();
    return deleteCustomerDataCore(deps, actor, customerId);
  });
}
