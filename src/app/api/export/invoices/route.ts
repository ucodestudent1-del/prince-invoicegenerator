import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureVerified } from "@/lib/org";
import { exportInvoices } from "@/lib/actions/reports";
import { auditContextFromRequest, recordAudit } from "@/lib/audit";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureVerified();
    const url = new URL(req["url"]);
    const formatParam = url["searchParams"]["get"]("format") || "csv";
    const format = formatParam === "xlsx" ? "xlsx" : "csv";
    const result = await exportInvoices(format);

    // Bulk data egress is a compliance-relevant event (Plan 2.4).
    await recordAudit({
      category: "DATA",
      action: "DATA_EXPORTED",
      orgId: session["user"]["organizationId"],
      actorId: session["user"]["id"],
      actorEmail: session["user"]["email"],
      actorRole: session["user"]["role"],
      targetType: "Invoice",
      metadata: { format, filename: result["filename"] },
      ...auditContextFromRequest(req),
    });

    if (format === "csv") {
      return new NextResponse(result["content"], {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${result["filename"]}"`,
        },
      });
    }

    const buffer = Buffer["from"](result["content"], "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${result["filename"]}"`,
      },
    });
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

