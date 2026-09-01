/**
 * Database drift utilities (Plan A1, Group A).
 *
 * Low-level helpers for detecting Prisma errors caused by a database that is
 * out of sync with the schema (missing columns, missing tables, missing enum
 * values). Plus a thin re-export of `withRetry` so high-level modules do not
 * need to depend on `@/lib/db` just to import the error predicates.
 *
 * Extracted from `@/lib/org` to break the historical circular import between
 * `org.ts` and `auth.ts`: under strict module initialization the import target
 * could be `undefined`. Domain modules now depend on this leaf utility module
 * rather than on each other.
 */

import { Prisma } from "@prisma/client";
import { withRetry as dbWithRetry } from "@/lib/db";

export { dbWithRetry as withRetry };

/**
 * Detects Prisma errors where a database column is missing (schema drift).
 */
export function isMissingColumnError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err["message"];
  return (
    Boolean(msg && msg["includes"]("does not exist in the current database")) ||
    (Boolean(msg && msg["includes"]("column")) && Boolean(msg && msg["includes"]("does not exist"))) ||
    Boolean(msg && msg["includes"]("42703")) // PostgreSQL undefined_column
  );
}

/**
 * Detects Prisma errors where a database table / relation is missing
 * (schema drift). Prisma reports a missing relation differently from a
 * missing column, so the audit module and the GDPR actions need a dedicated
 * predicate.
 */
export function isMissingTableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err["message"];
  return (
    Boolean(msg && msg["includes"]("does not exist in the current database")) ||
    (Boolean(msg && msg["includes"]("relation")) && Boolean(msg && msg["includes"]("does not exist"))) ||
    Boolean(msg && msg["includes"]("42P01")) // PostgreSQL undefined_table
  );
}

/**
 * Detects Prisma errors where an enum value is missing from the database
 * (schema drift). PostgreSQL error code 22P02 is `invalid_text_representation`.
 */
export function isInvalidEnumValueError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err["message"];
  return (
    Boolean(msg && msg["includes"]("invalid input value for enum")) ||
    Boolean(msg && msg["includes"]("22P02"))
  );
}

/**
 * True when the error is any of the drift classes this module knows about.
 * Convenient for code paths that want to ignore every flavour of schema drift
 * uniformly (e.g., `safely()` in `gdpr-core.ts`).
 */
export function isDriftError(err: unknown): boolean {
  return (
    isMissingColumnError(err) ||
    isMissingTableError(err) ||
    isInvalidEnumValueError(err)
  );
}

/**
 * Re-export of the `Prisma` namespace so callers that need to discriminate on
 * `PrismaClientKnownRequestError.code` (e.g., P2002 unique-constraint races) do
 * not have to import from `@prisma/client` themselves. This keeps the drift
 * module as the single import line for all schema-error handling.
 */
export { Prisma };
