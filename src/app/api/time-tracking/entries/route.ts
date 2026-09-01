import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTimeEntries, createManualTimeEntry } from "@/lib/actions/time-tracking";
import { ensureVerified } from "@/lib/org";
import { isMissingColumnError } from "@/lib/db-drift";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  await ensureVerified();
  return session;
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const url = new URL(req["url"]);
    const params: Record<string, any> = {};
    if (url["searchParams"]["get"]("userId")) params["userId"] = url["searchParams"]["get"]("userId");
    if (url["searchParams"]["get"]("projectId")) params["projectId"] = url["searchParams"]["get"]("projectId");
    if (url["searchParams"]["get"]("invoiceId")) {
      const val = url["searchParams"]["get"]("invoiceId");
      if (val === "null") params["invoiceId"] = null;
      else params["invoiceId"] = val;
    }
    if (url["searchParams"]["get"]("status")) params["status"] = url["searchParams"]["get"]("status");
    if (url["searchParams"]["get"]("billable") === "true") params["billable"] = true;
    if (url["searchParams"]["get"]("billable") === "false") params["billable"] = false;
    if (url["searchParams"]["get"]("dateFrom")) params["dateFrom"] = url["searchParams"]["get"]("dateFrom");
    if (url["searchParams"]["get"]("dateTo")) params["dateTo"] = url["searchParams"]["get"]("dateTo");
    if (url["searchParams"]["get"]("limit")) params["limit"] = Number(url["searchParams"]["get"]("limit"));

    const entries = await getTimeEntries(params);
    return NextResponse["json"](entries);
  } catch (err: any) {
    if (isMissingColumnError(err)) {
      return NextResponse["json"]([], { status: 200 });
    }
    if (err && err["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 403 });
    }
    if (err && err["message"] === "Unauthorized") {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
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
    await requireAuth();
    const body = await req["json"]();
    const entry = await createManualTimeEntry({
      projectId: body["projectId"],
      userId: body["userId"],
      startTime: body["startTime"],
      endTime: body["endTime"],
      duration: body["duration"],
      description: body["description"],
      billable: body["billable"] ?? true,
      hourlyRate: body["hourlyRate"] ?? 0,
      amount: body["amount"],
      isManual: body["isManual"] ?? true,
    });
    return NextResponse["json"](entry, { status: 201 });
  } catch (err: any) {
    if (err && err["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 403 });
    }
    if (err && err["message"] === "Unauthorized") {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    if (err && err["name"] === "ActionError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 400 });
    }
    logError("api:error", err);
    return NextResponse["json"]({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

