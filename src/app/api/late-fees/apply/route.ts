import { NextRequest, NextResponse } from "next/server";
import { applyLateFees } from "@/lib/actions/late-fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const results = await applyLateFees();
    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET();
}
