import Stripe from "stripe";

// Lazily-initialized Stripe client.
//
// We must NOT construct the client (nor read STRIPE_SECRET_KEY) at module load
// time: `next build` collects page data for API routes by importing their
// modules, and the Stripe secret is injected only at runtime (e.g. by the
// deployment env), not in the build environment. Constructing eagerly made
// `npm run build` fail with "STRIPE_SECRET_KEY is required" / "Failed to
// collect page data for /api/stripe/webhook".
//
// A Proxy defers construction to the first property access (request time),
// which happens inside request handlers where the env var is present. The
// `get` trap returns the *real* Stripe sub-object (`client.webhooks`,
// `client.customers`, ...) so method `this` binding is correct and callers
// keep using `stripe.webhooks.constructEvent(...)` unchanged.
let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is required");
    }
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2026-07-29.dahlia",
      typescript: true,
    });
  }
  return stripeClient;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

// Maps a Stripe price id back to an internal plan. Used in the webhook.
export const PRICE_TO_PLAN: Record<string, any> = {
  [process.env.STRIPE_PRICE_STARTER_MONTHLY ?? ""]: "STARTER",
  [process.env.STRIPE_PRICE_STARTER_YEARLY ?? ""]: "STARTER",
  [process.env.STRIPE_PRICE_PRO_MONTHLY ?? ""]: "PRO",
  [process.env.STRIPE_PRICE_PRO_YEARLY ?? ""]: "PRO",
  [process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? ""]: "BUSINESS",
  [process.env.STRIPE_PRICE_BUSINESS_YEARLY ?? ""]: "BUSINESS",
};

export const PLAN_TO_STRIPE_STATUS: Record<string, string> = {
  STARTER: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
  PRO: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
  BUSINESS: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? "",
};
