import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureVerified } from "@/lib/org";
import { anonymizeUser } from "@/lib/actions/gdpr";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GDPR Article 17 — right to erasure for an organization member.
 *
 * Irreversible. The `User` row is retained but stripped of personal data so
 * billable history that references it stays intact; credentials are destroyed
 * and every session revoked. OWNER/ADMIN only (enforced in the action).
 */
export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.["user"]) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureVerified();

    const { id } = await context["params"];
    await anonymizeUser(id);

    return NextResponse["json"]({ success: true, anonymizedUserId: id });
  } catch (err: any) {
    logError("api.admin.users.anonymize", err);
    if (err && err["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 403 });
    }
    if (err && err["name"] === "ActionError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 400 });
    }
    return NextResponse["json"]({ error: "Anonymization failed" }, { status: 500 });
  }
}
