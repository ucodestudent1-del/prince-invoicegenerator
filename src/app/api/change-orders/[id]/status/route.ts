import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureVerified } from "@/lib/org";
import { transitionChangeOrder } from "@/lib/actions/changeOrders";
import { logError } from "@/lib/logging";
import { CHANGE_ORDER_ACTIONS } from "@/lib/document-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureVerified();
    const body = await req["json"]();
    const action = body["action"];
    if (!action || typeof action !== "string") {
      return NextResponse["json"]({ error: "Missing 'action' field." }, { status: 400 });
    }
    const validActions = CHANGE_ORDER_ACTIONS;
    if (!validActions["includes"](action)) {
      return NextResponse["json"](
        { error: `Invalid action. Must be one of: ${validActions["join"](", ")}.` },
        { status: 400 }
      );
    }
    const result = await transitionChangeOrder(params["id"], action);
    return NextResponse["json"]({ success: true, ...result });
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
