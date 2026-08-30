import { NextRequest, NextResponse } from "next/server";
import { getEstimateByShareToken, recordEstimateView } from "@/lib/actions/estimates";
import { checkRateLimit } from "@/lib/action-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const searchParams = req["nextUrl"]["searchParams"];
  const token = searchParams["get"]("token");
  if (!token) {
    return NextResponse["json"]({ error: "Token is required" }, { status: 400 });
  }

  const ip = req["headers"]["get"]("x-forwarded-for") || req["headers"]["get"]("x-real-ip") || "unknown";
  if (!checkRateLimit(`estimate-view:${ip}`, 30, 60 * 1000)) {
    return NextResponse["json"]({ error: "Too many requests. Please try again later." }, { status: 429 });
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
