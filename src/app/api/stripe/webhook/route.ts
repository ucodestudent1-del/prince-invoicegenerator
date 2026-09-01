import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, PRICE_TO_PLAN } from "@/lib/stripe";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { logError, logWarn } from "@/lib/logging";
import { isMissingColumnError, isMissingTableError } from "@/lib/db-drift";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const signature = req["headers"]["get"]("stripe-signature");
  const webhookSecret = process["env"]["STRIPE_WEBHOOK_SECRET"];
  if (!signature || !webhookSecret) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  const body = await req["text"]();
  let event: Stripe.Event;
  try {
    event = stripe["webhooks"]["constructEvent"](body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err["message"] : "Invalid signature";
    return new NextResponse(`Webhook error: ${message}`, { status: 400 });
  }

  // ---- Idempotency: skip events we have already processed. ---------------
  // A duplicate delivery (Stripe retries for ~3 days) would otherwise
  // re-apply the same subscription change. The unique index on
  // `ProcessedStripeEvent.eventId` makes the insert itself the dedupe gate.
  try {
    await db["processedStripeEvent"]["create"]({
      data: {
        eventId: event["id"],
        eventType: event["type"],
        outcome: "OK",
      },
      select: { id: true },
    });
  } catch (err) {
    if (isDriftError(err)) {
      // Schema not migrated yet. Fail closed: a 500 makes Stripe retry,
      // which is the correct behaviour until the migration is applied.
      logError("stripe.webhook.idempotency", err, { eventId: event["id"] });
      return new NextResponse("Idempotency table unavailable", { status: 503 });
    }
    // P2002 = unique constraint. Already processed.
    if (err && typeof err === "object" && "code" in err && (err as { code?: string })["code"] === "P2002") {
      return NextResponse["json"]({ received: true, idempotent: true });
    }
    logError("stripe.webhook.idempotency", err, { eventId: event["id"] });
    return new NextResponse("Idempotency check failed", { status: 500 });
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
    // Distinguish permanent (4xx) from transient (5xx) failures. Permanent
    // errors must NOT 500, otherwise Stripe retries for ~3 days.
    if (isPermanentStripeError(err)) {
      logWarn("stripe.webhook.permanent", "Permanent error processing event; responding 200", {
        eventType: event["type"],
        eventId: event["id"],
        message: err instanceof Error ? err["message"] : String(err),
      });
      await markEventOutcome(event["id"], "INVALID_REQUEST", err).catch(() => undefined);
      return NextResponse["json"]({ received: true, skipped: "permanent-error" });
    }
    logError("stripe.webhook", err, { eventType: event["type"], eventId: event["id"] });
    await markEventOutcome(event["id"], "TRANSIENT_ERROR", err).catch(() => undefined);
    return new NextResponse("Handler error", { status: 500 });
  }

  return NextResponse["json"]({ received: true });
}

/**
 * Errors that should not be retried: invalid input, missing price, etc.
 * Stripe will keep trying 5xx for up to 3 days, which floods logs and
 * holds the system in a degraded state for a fault that will never resolve.
 */
function isPermanentStripeError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string; statusCode?: number; type?: string });
  if (code["type"] === "StripeInvalidRequestError") return true;
  if (typeof code["statusCode"] === "number" && code["statusCode"] >= 400 && code["statusCode"] < 500) {
    return true;
  }
  return false;
}

async function markEventOutcome(
  eventId: string,
  outcome: "OK" | "INVALID_REQUEST" | "TRANSIENT_ERROR",
  err: unknown
): Promise<void> {
  try {
    await db["processedStripeEvent"]["update"]({
      where: { eventId },
      data: {
        outcome,
        errorMessage: err instanceof Error ? err["message"]["slice"](0, 500) : String(err)["slice"](0, 500),
      },
      select: { id: true },
    });
  } catch {
    // Best-effort: a failure to record the outcome must not affect the
    // response, which has already been decided.
  }
}

function isDriftError(err: unknown): boolean {
  return isMissingColumnError(err) || isMissingTableError(err);
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
      select: { plan: true, stripeSubscriptionId: true, stripePriceId: true, subscriptionStatus: true, currentPeriodEnd: true },
    });
    previousPlan = existing?.["plan"];
  } catch {
    // Non-fatal: the audit entry simply omits the previous plan.
  }

  // Skip the write if the resulting state is identical to what's already in
  // the database. This both prevents spurious audit entries and keeps the
  // row stable when Stripe redelivers a `customer.subscription.updated` for
  // an unchanged subscription.
  const nextSubscriptionStatus = sub["status"]?.["toUpperCase"]();
  const nextCurrentPeriodEnd = sub["current_period_end"]
    ? new Date(sub["current_period_end"] * 1000)
    : null;
  try {
    const fresh = await db["organization"]["findUnique"]({
      where: { id: orgId },
      select: { plan: true, stripeSubscriptionId: true, stripePriceId: true, subscriptionStatus: true, currentPeriodEnd: true },
    });
    if (
      fresh &&
      fresh["plan"] === plan &&
      fresh["stripeSubscriptionId"] === sub["id"] &&
      fresh["stripePriceId"] === priceId &&
      fresh["subscriptionStatus"] === nextSubscriptionStatus &&
      sameTime(fresh["currentPeriodEnd"], nextCurrentPeriodEnd)
    ) {
      return;
    }
  } catch {
    // fall through to the update
  }

  await db["organization"]["update"]({
    where: { id: orgId },
    data: {
      plan,
      stripeSubscriptionId: sub["id"],
      stripePriceId: priceId,
      subscriptionStatus: nextSubscriptionStatus,
      currentPeriodEnd: nextCurrentPeriodEnd,
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
        subscriptionStatus: nextSubscriptionStatus ?? null,
        source: "stripe-webhook",
      },
    });
  }
}

function sameTime(a: Date | null, b: Date | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a["getTime"]() === b["getTime"]();
}
