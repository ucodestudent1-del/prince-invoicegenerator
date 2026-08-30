import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureVerified } from "@/lib/org";
import { getLateFeeConfig, saveLateFeeConfig } from "@/lib/actions/late-fees";
import { auditContextFromRequest, recordAudit } from "@/lib/audit";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureVerified();
    const config = await getLateFeeConfig();
    return NextResponse["json"](config);
  } catch (err: any) {
    if (err && err["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 403 });
    }
    if (err && err["name"] === "ActionError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 400 });
    }
    logError("api:error", err);
    return NextResponse["json"]({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureVerified();
    const body = await req["json"]();
    const config = await saveLateFeeConfig({
      enabled: body["enabled"] ?? false,
      rate: Number(body["rate"]) || 0,
      graceDays: Number(body["graceDays"]) || 0,
      fixedFee: Number(body["fixedFee"]) || 0,
      maxFee: body["maxFee"] ? Number(body["maxFee"]) : null,
    });

    // Late fees change what customers are charged, so changes are audited.
    await recordAudit({
      category: "SETTINGS",
      action: "LATE_FEE_SETTINGS_CHANGED",
      orgId: session["user"]["organizationId"],
      actorId: session["user"]["id"],
      actorEmail: session["user"]["email"],
      actorRole: session["user"]["role"],
      targetType: "LateFeeConfig",
      metadata: {
        enabled: body["enabled"] ?? false,
        rate: Number(body["rate"]) || 0,
        graceDays: Number(body["graceDays"]) || 0,
        fixedFee: Number(body["fixedFee"]) || 0,
        maxFee: body["maxFee"] ? Number(body["maxFee"]) : null,
      },
      ...auditContextFromRequest(req),
    });

    return NextResponse["json"](config);
  } catch (err: any) {
    if (err && err["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 403 });
    }
    if (err && err["name"] === "ActionError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 400 });
    }
    logError("api:error", err);
    return NextResponse["json"]({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

