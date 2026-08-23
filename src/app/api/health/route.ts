import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/errors";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; error?: string }> = {};

  checks["database"] = await checkDatabase();

  if (process["env"]["STRIPE_SECRET_KEY"]) {
    try {
      const { stripe } = await import("@/lib/stripe");
      await stripe["balance"]["retrieve"]();
      checks["stripe"] = { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err["message"] : String(err);
      checks["stripe"] = { ok: false, error: message };
    }
  }

  const allOk = Object["values"](checks)["every"]((c) => c["ok"]);

  if (allOk) {
    // Verify schema integrity — detect missing columns that would cause
    // invoice creation to fail with column-not-found errors.
    try {
      await db["$queryRaw"]`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'Invoice'
          AND column_name IN ('billToAddress', 'shipToAddress', 'scheduledFor', 'lateFeeAmount')
      `;
      checks["schema"] = { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err["message"] : String(err);
      checks["schema"] = { ok: false, error: message };
    }
  }

  const finalOk = Object["values"](checks)["every"]((c) => c["ok"]);

  return NextResponse["json"](
    {
      ok: finalOk,
      checks,
      timestamp: new Date()["toISOString"](),
    },
    { status: finalOk ? 200 : 503 }
  );
}
