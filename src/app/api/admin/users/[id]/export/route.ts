import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureVerified } from "@/lib/org";
import { exportUserData } from "@/lib/actions/gdpr";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GDPR Article 15 — data-subject access request for an organization member.
 * Returns a downloadable JSON bundle. OWNER/ADMIN only (enforced in the action).
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.["user"]) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureVerified();

    const { id } = await context["params"];
    const bundle = await exportUserData(id);

    return new NextResponse(JSON["stringify"](bundle, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="user-${id}-export.json"`,
        // Personal data must never be cached by a proxy or the browser.
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: any) {
    logError("api.admin.users.export", err);
    if (err && err["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 403 });
    }
    if (err && err["name"] === "ActionError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 400 });
    }
    return NextResponse["json"]({ error: "Export failed" }, { status: 500 });
  }
}
