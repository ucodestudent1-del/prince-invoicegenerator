import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireUser } from "@/lib/org";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await requireUser();
  if (!user["organizationId"]) {
    return NextResponse["json"]({ error: "No organization" }, { status: 400 });
  }
  const org = await db["organization"]["findUnique"]({
    where: { id: user["organizationId"] },
    select: { stripeCustomerId: true },
  });
  if (!org?.["stripeCustomerId"]) {
    return NextResponse["json"]({ error: "No customer" }, { status: 400 });
  }

  const appUrl = process["env"]["NEXT_PUBLIC_APP_URL"];
  if (!appUrl) {
    return NextResponse["json"](
      { error: "Server misconfigured: NEXT_PUBLIC_APP_URL is missing" },
      { status: 500 }
    );
  }

  const portal = await stripe["billingPortal"]["sessions"]["create"]({
    customer: org["stripeCustomerId"],
    return_url: `${appUrl}/dashboard/billing`,
  });

  return NextResponse["json"]({ url: portal["url"] });
}
