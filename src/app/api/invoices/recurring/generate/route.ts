import { NextRequest, NextResponse } from "next/server";
import { processRecurringInvoices } from "@/lib/actions/recurring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const results = await processRecurringInvoices();
    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET();
}
