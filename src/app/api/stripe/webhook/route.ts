import { NextRequest, NextResponse } from "next/server";
import { stripe, PRICE_TO_PLAN } from "@/lib/stripe";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return new NextResponse(`Webhook error: ${message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        await updateSubscriptionFromSession(session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as any;
        await updateSubscription(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        if (sub.metadata?.orgId) {
          await db.organization.update({
            where: { id: sub.metadata.orgId },
            data: { plan: "FREE", subscriptionStatus: "CANCELED", stripeSubscriptionId: null },
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Stripe webhook handler error", err);
    return new NextResponse("Handler error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function updateSubscriptionFromSession(session: any) {
  const orgId = session.metadata?.orgId;
  if (!orgId) return;
  const subscriptionId = session.subscription;
  if (!subscriptionId) return;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  await updateSubscription(sub as any, orgId);
}

async function updateSubscription(sub: any, orgIdOverride?: string) {
  const orgId = orgIdOverride ?? sub.metadata?.orgId;
  if (!orgId) return;

  const priceId = sub.items?.data?.[0]?.price?.id;
  const plan = PRICE_TO_PLAN[priceId] ?? "FREE";

  await db.organization.update({
    where: { id: orgId },
    data: {
      plan,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      subscriptionStatus: sub.status?.toUpperCase(),
      currentPeriodEnd: sub.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : null,
    },
  });
}
