import { NextRequest, NextResponse } from "next/server";
import { acceptEstimate } from "@/lib/actions/estimates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const searchParams = req["nextUrl"]["searchParams"];
  const token = searchParams["get"]("token");
  if (!token) {
    return NextResponse["json"]({ error: "Token is required" }, { status: 400 });
  }

  try {
    const body = await req["json"]();
    const result = await acceptEstimate(token, body["comment"]);
    return NextResponse["json"](result);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}
