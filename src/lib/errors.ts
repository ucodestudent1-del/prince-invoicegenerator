import { db } from "@/lib/db";
import { withRetry } from "@/lib/db";
import { logError } from "@/lib/logging";

const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
] as const;

const PROD_ONLY_ENV_VARS = [
  "BACKGROUND_JOB_API_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_STARTER_MONTHLY",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_BUSINESS_MONTHLY",
] as const;

export function validateEnv(): void {
  if (typeof window !== "undefined") return;
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const msg = `[env] Missing required environment variables: ${missing.join(", ")}`;
    console.error(msg);
    if (process.env.NODE_ENV === "production") {
      throw new Error(msg);
    }
  }

  // Log warnings for production-only env vars that are missing.
  // Only warn (don't throw) so builds don't fail in CI/preview environments.
  const missingProd = PROD_ONLY_ENV_VARS.filter((key) => !process.env[key]);
  if (missingProd.length > 0) {
    console.warn(`[env] Production environment variables not set: ${missingProd.join(", ")}`);
  }
}

export function logServerError(context: string, err: unknown) {
  logError(context, err);
}

export async function checkDatabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    await withRetry(() => db.$queryRaw`SELECT 1`);
    return { ok: true };
  } catch (err) {
    logError("Database health check", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}