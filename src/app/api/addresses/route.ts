import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureVerified } from "@/lib/org";
import { createAddress, getCustomerAddresses } from "@/lib/actions/addresses";
import { checkRateLimit } from "@/lib/action-rate-limit";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureVerified();
    const url = new URL(req["url"]);
    const customerId = url["searchParams"]["get"]("customerId");
    if (!customerId) {
      return NextResponse["json"]({ error: "customerId is required" }, { status: 400 });
    }
    const addresses = await getCustomerAddresses(customerId);
    return NextResponse["json"](addresses);
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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureVerified();

    if (!(await checkRateLimit(`api:addresses:${session.user.email}`, 30, 60 * 1000))) {
      return NextResponse["json"]({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req["json"]();
    const address = await createAddress({
      customerId: body["customerId"],
      label: body["label"],
      type: body["type"],
      line1: body["line1"],
      line2: body["line2"],
      city: body["city"],
      state: body["state"],
      postalCode: body["postalCode"],
      country: body["country"],
      isDefault: body["isDefault"],
    });
    return NextResponse["json"](address);
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

