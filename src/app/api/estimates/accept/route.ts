import { NextRequest, NextResponse } from "next/server";
import { acceptEstimate } from "@/lib/actions/estimates";
import { checkRateLimit } from "@/lib/action-rate-limit";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const searchParams = req["nextUrl"]["searchParams"];
  const token = searchParams["get"]("token");
  if (!token) {
    return NextResponse["json"]({ error: "Token is required" }, { status: 400 });
  }

  const ip = req["headers"]["get"]("x-forwarded-for") || req["headers"]["get"]("x-real-ip") || "unknown";
  if (!(await checkRateLimit(`estimate-accept:${ip}`, 10, 60 * 1000))) {
    return NextResponse["json"]({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const body = await req["json"]();
    const result = await acceptEstimate(token, body["comment"]);
    return NextResponse["json"](result);
  } catch (err: any) {
    if (err && err["name"] === "ActionError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 400 });
    }
    logError("api:error", err);
    return NextResponse["json"]({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
