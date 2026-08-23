import { NextRequest, NextResponse } from "next/server";
import { getEstimateByShareToken, recordEstimateView } from "@/lib/actions/estimates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const searchParams = req["nextUrl"]["searchParams"];
  const token = searchParams["get"]("token");
  if (!token) {
    return NextResponse["json"]({ error: "Token is required" }, { status: 400 });
  }

  try {
    const estimate = await getEstimateByShareToken(token);
    if (!estimate) {
      return NextResponse["json"]({ error: "Estimate not found" }, { status: 404 });
    }

    await recordEstimateView(token);

    return NextResponse["json"](estimate);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}
