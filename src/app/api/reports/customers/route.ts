import { NextRequest, NextResponse } from "next/server";
import { getCustomerAnalytics } from "@/lib/actions/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const report = await getCustomerAnalytics();
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
