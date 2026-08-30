/**
 * Security and compliance audit trail (Plan 2.4).
 *
 * Complements `InvoiceAudit` / `EstimateAudit` (financial documents) with the
 * non-financial events a commercial deployment must be able to prove:
 * authentication, admin actions, settings changes, data exports and destructive
 * operations.
 *
 * Design rules:
 * - **Append-only.** This module exposes no update or delete helper, and the
 *   migration installs a trigger rejecting UPDATE/DELETE on the table.
 * - **Never throws.** Audit writes are best-effort: a failure here must not roll
 *   back or fail the business operation that triggered it. Failures are logged.
 * - **Drift-safe.** If the table has not been migrated yet the write is skipped
 *   with a warning, consistent with the rest of the codebase.
 */

import { db } from "@/lib/db";
import { logError, logWarn } from "@/lib/logging";
import { getRequestId } from "@/lib/request-id";
import { isMissingColumnError } from "@/lib/org";

export type AuditCategory = "AUTH" | "ADMIN" | "SETTINGS" | "DATA" | "BILLING" | "SECURITY";

export type AuditAction =
  // AUTH
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "SIGNUP"
  | "EMAIL_VERIFIED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "VERIFICATION_EMAIL_RESENT"
  // ADMIN
  | "USER_INVITED"
  | "USER_REMOVED"
  | "ROLE_CHANGED"
  | "PLAN_CHANGED"
  // SETTINGS
  | "REMINDER_SETTINGS_CHANGED"
  | "LATE_FEE_SETTINGS_CHANGED"
  | "ORG_SETTINGS_CHANGED"
  // DATA
  | "DATA_EXPORTED"
  | "BULK_DELETE"
  | "ORG_DELETED"
  | "USER_ANONYMIZED"
  | "CUSTOMER_DATA_DELETED"
  // SECURITY
  | "CSRF_REJECTED"
  | "RATE_LIMITED";

export type AuditOutcome = "SUCCESS" | "FAILURE";

export type AuditEntry = {
  category: AuditCategory;
  action: AuditAction;
  orgId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  outcome?: AuditOutcome;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Metadata keys that must never reach the audit table. */
const FORBIDDEN_METADATA_KEYS = ["password", "token", "secret", "pin", "apikey", "api_key"];

function sanitizeMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object["entries"](metadata)) {
    const normalized = key["toLowerCase"]()["replace"](/[-_\s]/g, "");
    if (FORBIDDEN_METADATA_KEYS["some"]((bad) => normalized["includes"](bad["replace"](/_/g, "")))) {
      continue;
    }
    out[key] = value;
  }
  return Object["keys"](out)["length"] > 0 ? out : undefined;
}

/** Truncate free-form strings so a hostile client cannot bloat the table. */
function clamp(value: string | null | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return value["length"] > max ? value["slice"](0, max) : value;
}

/**
 * Append an audit entry. Fire-and-forget: callers may `void` the promise.
 * Never rejects.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db["auditLog"]["create"]({
      data: {
        orgId: entry["orgId"] ?? null,
        actorId: entry["actorId"] ?? null,
        actorEmail: clamp(entry["actorEmail"], 320) ?? null,
        actorRole: entry["actorRole"] ?? null,
        category: entry["category"],
        action: entry["action"],
        targetType: entry["targetType"] ?? null,
        targetId: entry["targetId"] ?? null,
        outcome: entry["outcome"] ?? "SUCCESS",
        ip: clamp(entry["ip"], 64) ?? null,
        userAgent: clamp(entry["userAgent"], 512) ?? null,
        requestId: getRequestId() ?? null,
        metadata: (sanitizeMetadata(entry["metadata"]) ?? null) as never,
      },
      select: { id: true },
    });
  } catch (err) {
    if (isMissingColumnError(err) || isMissingTableError(err)) {
      logWarn("audit", "AuditLog table is not migrated — audit entry dropped", {
        category: entry["category"],
        action: entry["action"],
      });
      return;
    }
    // An audit write must never break the operation it is recording.
    logError("audit", err, { category: entry["category"], action: entry["action"] });
  }
}

/**
 * The audit table may be entirely absent before the migration runs, which
 * Prisma reports differently from a missing column.
 */
function isMissingTableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err["message"];
  return (
    msg["includes"]("does not exist in the current database") ||
    msg["includes"]("relation") && msg["includes"]("does not exist") ||
    msg["includes"]("42P01") // PostgreSQL undefined_table
  );
}

/**
 * Extract client attribution from a request without pulling in a route-handler
 * dependency. Safe to call with a plain `Request`.
 */
export function auditContextFromRequest(req: Request): { ip: string; userAgent: string | undefined } {
  const forwarded = req["headers"]["get"]("x-forwarded-for");
  const ip =
    forwarded?.["split"](",")[0]?.["trim"]() ||
    req["headers"]["get"]("x-real-ip") ||
    req["headers"]["get"]("cf-connecting-ip") ||
    "unknown";
  return { ip, userAgent: req["headers"]["get"]("user-agent") ?? undefined };
}

/**
 * Read recent audit entries for an organization. Read-only by construction.
 */
export async function listAuditEntries(options: {
  orgId: string;
  limit?: number;
  category?: AuditCategory;
}) {
  const take = Math["min"](Math["max"](options["limit"] ?? 100, 1), 500);
  try {
    return await db["auditLog"]["findMany"]({
      where: {
        orgId: options["orgId"],
        ...(options["category"] ? { category: options["category"] } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
    });
  } catch (err) {
    if (isMissingColumnError(err) || isMissingTableError(err)) return [];
    logError("audit.list", err);
    return [];
  }
}
