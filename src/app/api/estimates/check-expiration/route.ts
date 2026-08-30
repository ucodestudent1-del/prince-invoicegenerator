import { NextRequest, NextResponse } from "next/server";
import { checkExpiredEstimates } from "@/lib/actions/estimates";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureVerified } from "@/lib/org";
import { checkRateLimit } from "@/lib/action-rate-limit";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureVerified();
  return session;
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof Response) return authResult;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await checkRateLimit(`check-expiration:${session.user.email}`, 10, 60 * 1000))) {
      return NextResponse["json"]({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const result = await checkExpiredEstimates();
    return NextResponse["json"](result);
  } catch (err: any) {
    if (err && err["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 403 });
    }
    if (err && err["name"] === "ActionError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 400 });
    }
    logError("api:error", err);
    return NextResponse["json"]({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
