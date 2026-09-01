import { NextRequest, NextResponse } from "next/server";
import { processRecurringInvoices } from "@/lib/actions/recurring";
import { applyLateFees } from "@/lib/actions/late-fees";
import { logError } from "@/lib/logging";
import { isBackgroundJobAuthorized } from "@/lib/background-job-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isBackgroundJobAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const url = new URL(req["url"]);
    const steps = url["searchParams"]["get"]("steps")?.["split"](",") || ["all"];

    const results: any = {};

    for (const step of steps) {
      try {
        if (step === "recurring" || step === "all") {
          results["recurring"] = await processRecurringInvoices();
        }
        if (step === "late-fees" || step === "all") {
          results["lateFees"] = await applyLateFees();
        }
        if (step === "reminders" || step === "all") {
          // Reminders are handled separately - import the logic
          results["reminders"] = "skipped (use /api/reminders/check)";
        }
      } catch (err) {
        logError(`automation:${step}`, err);
        results[step] = { error: err instanceof Error ? err["message"] : "Failed" };
      }
    }

    return NextResponse["json"]({ success: true, results });
  } catch (err) {
    logError("automation", err);
    return NextResponse["json"]({ error: "Failed to run automation." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
