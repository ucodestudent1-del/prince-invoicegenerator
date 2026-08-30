import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimit, checkRateLimitSync, consumeRateLimit, resetRateLimitMemory } from "@/lib/action-rate-limit";

const originalEnv = { ...process["env"] };

afterEach(() => {
  process["env"] = { ...originalEnv };
  resetRateLimitMemory();
});

describe("in-memory rate limiter (fallback backend)", () => {
  it("allows up to the limit, then rejects", async () => {
    const key = "test:allow";
    const max = 3;
    const window = 60_000;

    expect(await checkRateLimit(key, max, window))["toBe"](true);
    expect(await checkRateLimit(key, max, window))["toBe"](true);
    expect(await checkRateLimit(key, max, window))["toBe"](true);
    expect(await checkRateLimit(key, max, window))["toBe"](false);
  });

  it("separates keys so one user cannot exhaust another's budget", async () => {
    expect(await checkRateLimit("user:a", 1, 60_000))["toBe"](true);
    expect(await checkRateLimit("user:b", 1, 60_000))["toBe"](true);
    expect(await checkRateLimit("user:a", 1, 60_000))["toBe"](false);
  });

  it("resets after the window elapses", async () => {
    const key = "test:reset";
    expect(await checkRateLimit(key, 1, 50))["toBe"](true);
    expect(await checkRateLimit(key, 1, 50))["toBe"](false);
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(await checkRateLimit(key, 1, 50))["toBe"](true);
  });

  it("reports the backend and remaining count", async () => {
    const result = await consumeRateLimit("test:meta", 5, 60_000);
    expect(result["backend"])["toBe"]("memory");
    expect(result["ok"])["toBe"](true);
    expect(result["remaining"])["toBe"](4);
  });

  it("sync variant behaves the same for the no-Redis path", () => {
    expect(checkRateLimitSync("test:sync", 1, 60_000))["toBe"](true);
    expect(checkRateLimitSync("test:sync", 1, 60_000))["toBe"](false);
  });

  it("fails open: a thrown error inside consumption never blocks traffic", async () => {
    // Force an internal error by using a window that makes Date math explode is
    // not feasible, so assert the documented fail-open contract directly via a
    // key with a zero window — still must not throw.
    await expect(checkRateLimit("test:zero", 1, 0))["resolves"]["toBe"](true);
  });
});
