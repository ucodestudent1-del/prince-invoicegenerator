import { NextRequest, NextResponse } from "next/server";
import { applyLateFees } from "@/lib/actions/late-fees";
import { isBackgroundJobAuthorized } from "@/lib/background-job-auth";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isBackgroundJobAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const results = await applyLateFees();
    return NextResponse["json"]({ success: true, results });
  } catch (err: any) {
    logError("api:error", err);
    return NextResponse["json"]({ error: "An internal error occurred" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
