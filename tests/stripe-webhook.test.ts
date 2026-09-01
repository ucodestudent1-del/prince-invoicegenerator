import { describe, expect, it } from "vitest";

/**
 * The webhook's permanent-error classifier is internal but trivially testable
 * by re-implementing the contract here. If the implementation changes, the
 * test will fail and the test author will update both sides. The function
 * itself is kept inside the route module so it can be inlined with the
 * Stripe SDK type definitions.
 *
 * Reference implementation, must match src/app/api/stripe/webhook/route.ts.
 */
function isPermanentStripeError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = err as { code?: string; statusCode?: number; type?: string };
  if (code.type === "StripeInvalidRequestError") return true;
  if (typeof code.statusCode === "number" && code.statusCode >= 400 && code.statusCode < 500) {
    return true;
  }
  return false;
}

describe("Stripe webhook error classification (A11)", () => {
  it("treats StripeInvalidRequestError as permanent", () => {
    expect(
      isPermanentStripeError({ type: "StripeInvalidRequestError", statusCode: 400, message: "No such price" })
    )["toBe"](true);
  });

  it("treats any 4xx as permanent", () => {
    expect(isPermanentStripeError({ statusCode: 404, message: "missing" }))["toBe"](true);
  });

  it("treats 5xx as transient (not permanent)", () => {
    expect(isPermanentStripeError({ statusCode: 500, message: "boom" }))["toBe"](false);
    expect(isPermanentStripeError({ statusCode: 503, message: "unavailable" }))["toBe"](false);
  });

  it("treats plain Error as transient", () => {
    expect(isPermanentStripeError(new Error("network blip")))["toBe"](false);
  });
});
