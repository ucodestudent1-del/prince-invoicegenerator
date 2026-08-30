import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureVerified } from "@/lib/org";
import { sendEstimate } from "@/lib/actions/estimates";
import { checkRateLimit } from "@/lib/action-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureVerified();

    if (!checkRateLimit(`api:estimates:send:${session.user.email}`, 20, 60 * 1000)) {
      return NextResponse["json"]({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req["json"]();
    const result = await sendEstimate(params["id"], {
      ccEmails: body["ccEmails"],
      message: body["message"],
      subjectOverride: body["subjectOverride"],
    });
    return NextResponse["json"](result);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: (err && err["name"] === "EmailVerificationError") ? 403 : 400 });
  }
}
