import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2025-03-31.basil",
  typescript: true,
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
