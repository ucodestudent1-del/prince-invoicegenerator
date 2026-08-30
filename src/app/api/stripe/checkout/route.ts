import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureVerified } from "@/lib/org";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limit = await rateLimit(req);
  if (!limit["ok"]) {
    return NextResponse["json"]({ error: "Too many requests" }, { status: 429 });
  }

  const authSession = await getServerSession(authOptions);
  if (!authSession?.["user"]) {
    return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureVerified();
  const user = authSession["user"];
  if (!user["organizationId"]) {
    return NextResponse["json"]({ error: "No organization" }, { status: 400 });
  }

  try {
    const { plan } = await req["json"]();
    const planDef = getPlan(plan);
    if (!planDef || !planDef["stripePriceId"]) {
      return NextResponse["json"]({ error: "Invalid plan" }, { status: 400 });
    }
    const priceId = planDef["stripePriceId"];

    const appUrl = process["env"]["NEXT_PUBLIC_APP_URL"];
    if (!appUrl) {
      return NextResponse["json"](
        { error: "Server misconfigured: NEXT_PUBLIC_APP_URL is missing" },
        { status: 500 }
      );
    }

    const org = await db["organization"]["findUnique"]({
      where: { id: user["organizationId"] },
      select: { id: true, name: true, stripeCustomerId: true },
    });

    if (!org) {
      return NextResponse["json"]({ error: "Organization not found" }, { status: 400 });
    }

    let customerId = org["stripeCustomerId"];
    if (!customerId) {
      const customer = await stripe["customers"]["create"]({
        email: user["email"] ?? undefined,
        name: org["name"],
        metadata: { orgId: org["id"] },
      });
      customerId = customer["id"];
      await db["organization"]["update"]({
        where: { id: org["id"] },
        data: { stripeCustomerId: customerId },
        select: { id: true },
      });
    }

    const session = await stripe["checkout"]["sessions"]["create"]({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/billing?success=1`,
      cancel_url: `${appUrl}/pricing`,
      subscription_data: { metadata: { orgId: org["id"] } },
      metadata: { orgId: org["id"] },
    });

    return NextResponse["json"]({ url: session["url"] });
  } catch (err: any) {
    logError("stripe-checkout", err);
    if (err && err["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: "Email verification required" }, { status: 403 });
    }
    if (err && err["name"] === "ActionError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 400 });
    }
    const status = err?.["statusCode"] === 400 ? 400 : 500;
    return NextResponse["json"]({ error: "Checkout failed" }, { status });
  }
}
