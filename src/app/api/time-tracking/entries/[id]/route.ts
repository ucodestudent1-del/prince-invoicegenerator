import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTimeEntry, updateTimeEntry, deleteTimeEntry, approveTimeEntries, setTimeEntryInvoice, getTimeEntriesForInvoice } from "@/lib/actions/time-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth();
    const url = new URL(req["url"]);
    const action = url["searchParams"]["get"]("action");

    if (action === "for-invoice") {
      const query: Record<string, any> = {};
      if (url["searchParams"]["get"]("userId")) query["userId"] = url["searchParams"]["get"]("userId");
      if (url["searchParams"]["get"]("projectId")) query["projectId"] = url["searchParams"]["get"]("projectId");
      if (url["searchParams"]["get"]("dateFrom")) query["dateFrom"] = url["searchParams"]["get"]("dateFrom");
      if (url["searchParams"]["get"]("dateTo")) query["dateTo"] = url["searchParams"]["get"]("dateTo");
      const entries = await getTimeEntriesForInvoice(query);
      return NextResponse["json"](entries);
    }

    const entry = await getTimeEntry(params["id"]);
    return NextResponse["json"](entry);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth();
    const body = await req["json"]();
    const action = body["action"];

    if (action === "approve") {
      return NextResponse["json"](await approveTimeEntries([params["id"]]));
    }

    if (action === "link-invoice") {
      return NextResponse["json"](await setTimeEntryInvoice(params["id"], body["invoiceId"]));
    }

    const entry = await updateTimeEntry(params["id"], {
      projectId: body["projectId"],
      userId: body["userId"],
      startTime: body["startTime"],
      endTime: body["endTime"],
      duration: body["duration"],
      description: body["description"],
      billable: body["billable"],
      hourlyRate: body["hourlyRate"],
      amount: body["amount"],
      isManual: body["isManual"],
      status: body["status"],
    });
    return NextResponse["json"](entry);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth();
    const result = await deleteTimeEntry(params["id"]);
    return NextResponse["json"](result);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}
