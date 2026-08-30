import { NextRequest, NextResponse } from "next/server";
import { stripe, PRICE_TO_PLAN } from "@/lib/stripe";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const signature = req["headers"]["get"]("stripe-signature");
  const webhookSecret = process["env"]["STRIPE_WEBHOOK_SECRET"];
  if (!signature || !webhookSecret) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  const body = await req["text"]();
  let event;
  try {
    event = stripe["webhooks"]["constructEvent"](body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err["message"] : "Invalid signature";
    return new NextResponse(`Webhook error: ${message}`, { status: 400 });
  }

  try {
    switch (event["type"]) {
      case "checkout.session.completed": {
        const session = event["data"]["object"] as any;
        await updateSubscriptionFromSession(session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event["data"]["object"] as any;
        await updateSubscription(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event["data"]["object"] as any;
        if (sub["metadata"]?.["orgId"]) {
          await db["organization"]["update"]({
            where: { id: sub["metadata"]["orgId"] },
            data: { plan: "FREE", subscriptionStatus: "CANCELED", stripeSubscriptionId: null },
            select: { id: true },
          });
          await recordAudit({
            category: "BILLING",
            action: "PLAN_CHANGED",
            orgId: sub["metadata"]["orgId"],
            targetType: "Organization",
            targetId: sub["metadata"]["orgId"],
            metadata: { plan: "FREE", subscriptionStatus: "CANCELED", source: "stripe-webhook" },
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    logError("stripe.webhook", err, { eventType: event["type"] });
    return new NextResponse("Handler error", { status: 500 });
  }

  return NextResponse["json"]({ received: true });
}

async function updateSubscriptionFromSession(session: any) {
  const orgId = session["metadata"]?.["orgId"];
  if (!orgId) return;
  const subscriptionId = session["subscription"];
  if (!subscriptionId) return;
  const sub = await stripe["subscriptions"]["retrieve"](subscriptionId);
  await updateSubscription(sub as any, orgId);
}

async function updateSubscription(sub: any, orgIdOverride?: string) {
  const orgId = orgIdOverride ?? sub["metadata"]?.["orgId"];
  if (!orgId) return;

  const priceId = sub["items"]?.["data"]?.[0]?.["price"]?.["id"];
  const plan = PRICE_TO_PLAN[priceId] ?? "FREE";

  // Capture the prior plan so the audit entry shows the transition.
  let previousPlan: string | undefined;
  try {
    const existing = await db["organization"]["findUnique"]({
      where: { id: orgId },
      select: { plan: true },
    });
    previousPlan = existing?.["plan"];
  } catch {
    // Non-fatal: the audit entry simply omits the previous plan.
  }

  await db["organization"]["update"]({
    where: { id: orgId },
    data: {
      plan,
      stripeSubscriptionId: sub["id"],
      stripePriceId: priceId,
      subscriptionStatus: sub["status"]?.["toUpperCase"](),
      currentPeriodEnd: sub["current_period_end"]
        ? new Date(sub["current_period_end"] * 1000)
        : null,
    },
    select: { id: true },
  });

  if (previousPlan !== plan) {
    await recordAudit({
      category: "BILLING",
      action: "PLAN_CHANGED",
      orgId,
      targetType: "Organization",
      targetId: orgId,
      metadata: {
        fromPlan: previousPlan ?? null,
        toPlan: plan,
        subscriptionStatus: sub["status"]?.["toUpperCase"]() ?? null,
        source: "stripe-webhook",
      },
    });
  }
}
