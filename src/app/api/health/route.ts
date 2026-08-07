import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; error?: string }> = {};

  checks.database = await checkDatabase();

  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const { stripe } = await import("@/lib/stripe");
      await stripe.balance.retrieve();
      checks.stripe = { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      checks.stripe = { ok: false, error: message };
    }
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      ok: allOk,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  );
}
