import { NextRequest, NextResponse } from "next/server";
import { getFinancialDashboardData } from "@/lib/actions/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const data = await getFinancialDashboardData();
    return NextResponse["json"](data);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}
