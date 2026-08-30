import { NextRequest, NextResponse } from "next/server";import { checkDatabase } from "@/lib/errors";
import { db } from "@/lib/db";
import { isBackgroundJobAuthorized } from "@/lib/background-job-auth";
import { isRedisAvailable, isRedisConfigured } from "@/lib/redis";
import { errorTrackingConfigured } from "@/lib/logging";
import { getRequestId } from "@/lib/request-id";
import { buildHealthResponse } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health endpoint. The decision logic lives in `src/lib/health.ts` so it can be
 * unit-tested without mocking the database or Stripe modules. This handler only
 * wires the real dependencies and formats the response.
 */

async function checkSchema(): Promise<{ ok: boolean; error?: string }> {
  try {
    await db["$queryRaw"]`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Invoice'
        AND column_name IN ('billToAddress', 'shipToAddress', 'scheduledFor', 'lateFeeAmount')
    `;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err["message"] : String(err) };
  }
}

async function checkStripe(): Promise<{ ok: boolean; error?: string } | null> {
  if (!process["env"]["STRIPE_SECRET_KEY"]) return null;
  try {
    const { stripe } = await import("@/lib/stripe");
    await stripe["balance"]["retrieve"]();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err["message"] : String(err) };
  }
}

export async function GET(req: NextRequest) {
  const { status, body } = await buildHealthResponse(req, {
    checkDatabase: () => checkDatabase(),
    checkSchema,
    checkStripe,
    isAuthorized: (r) => isBackgroundJobAuthorized(r as unknown as NextRequest),
    isRedisConfigured,
    isRedisAvailable,
    errorTrackingConfigured,
    getRequestId,
  });

  return NextResponse["json"](body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
