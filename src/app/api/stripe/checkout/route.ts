import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireUser } from "@/lib/org";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user.organizationId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const { plan } = await req.json();
  const planDef = getPlan(plan);
  const priceId = planDef.stripePriceId;
  if (!priceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const org = await db.organization.findUnique({
    where: { id: user.organizationId },
  });

  let customerId = org?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: org?.name,
      metadata: { orgId: org!.id },
    });
    customerId = customer.id;
    await db.organization.update({
      where: { id: org!.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    subscription_data: { metadata: { orgId: org!.id } },
    metadata: { orgId: org!.id },
  });

  return NextResponse.json({ url: session.url });
}
