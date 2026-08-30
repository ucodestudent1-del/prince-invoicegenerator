import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureVerified } from "@/lib/org";
import { exportCustomerData } from "@/lib/actions/gdpr";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GDPR Article 15 — data-subject access request for a customer.
 * Returns every document raised against them as a downloadable JSON bundle.
 * OWNER/ADMIN only (enforced in the action).
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.["user"]) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureVerified();

    const { id } = await context["params"];
    const bundle = await exportCustomerData(id);

    return new NextResponse(JSON["stringify"](bundle, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="customer-${id}-export.json"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: any) {
    logError("api.admin.customers.export", err);
    if (err && err["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 403 });
    }
    if (err && err["name"] === "ActionError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 400 });
    }
    return NextResponse["json"]({ error: "Export failed" }, { status: 500 });
  }
}
