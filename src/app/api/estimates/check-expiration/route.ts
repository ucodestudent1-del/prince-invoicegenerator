import { NextRequest, NextResponse } from "next/server";
import { checkExpiredEstimates } from "@/lib/actions/estimates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const result = await checkExpiredEstimates();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
