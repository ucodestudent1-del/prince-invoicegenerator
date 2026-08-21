import { NextRequest, NextResponse } from "next/server";
import { sendEstimate } from "@/lib/actions/estimates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const result = await sendEstimate(params.id, {
      ccEmails: body.ccEmails,
      message: body.message,
      subjectOverride: body.subjectOverride,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
