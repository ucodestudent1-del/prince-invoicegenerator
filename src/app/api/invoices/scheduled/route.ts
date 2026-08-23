import { NextRequest, NextResponse } from "next/server";
import { processScheduledInvoices } from "@/lib/actions/recurring";
import { isBackgroundJobAuthorized } from "@/lib/background-job-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isBackgroundJobAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const results = await processScheduledInvoices();
    return NextResponse["json"]({ success: true, results });
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
