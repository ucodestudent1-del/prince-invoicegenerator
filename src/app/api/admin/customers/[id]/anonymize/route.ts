import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureVerified } from "@/lib/org";
import { anonymizeCustomer, deleteCustomerData } from "@/lib/actions/gdpr";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GDPR Article 17 — right to erasure for a single customer (Plan 2.7).
 *
 * Two modes, selected by the `mode` field of the JSON body:
 * - `anonymize` (default) — strips personal identifiers but keeps invoices and
 *   payments, which carry statutory retention obligations.
 * - `delete` — hard-deletes the customer and all their documents. Destroys
 *   financial history; only valid where no retention obligation applies.
 *
 * OWNER/ADMIN only (enforced in the actions).
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.["user"]) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureVerified();

    const { id } = await context["params"];

    let mode = "anonymize";
    try {
      const body = await req["json"]();
      if (body?.["mode"] === "delete") mode = "delete";
    } catch {
      // No body sent — keep the safe default.
    }

    if (mode === "delete") {
      await deleteCustomerData(id);
    } else {
      await anonymizeCustomer(id);
    }

    return NextResponse["json"]({ success: true, customerId: id, mode });
  } catch (err: any) {
    logError("api.admin.customers.anonymize", err);
    if (err && err["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 403 });
    }
    if (err && err["name"] === "ActionError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 400 });
    }
    return NextResponse["json"]({ error: "Erasure failed" }, { status: 500 });
  }
}
