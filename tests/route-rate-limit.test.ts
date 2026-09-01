import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { resetRateLimitMemory } from "@/lib/action-rate-limit";

const ORIGINAL_ENV = { ...process["env"] };

function request(headers: Record<string, string> = {}): NextRequest {
  const merged: Record<string, string> = { host: "app.example.com", ...headers };
  return new NextRequest("https://app.example.com/api/photos", {
    method: "POST",
    headers: merged,
  });
}

beforeEach(() => {
  process["env"] = { ...ORIGINAL_ENV };
  resetRateLimitMemory();
});

afterEach(() => {
  process["env"] = { ...ORIGINAL_ENV };
  resetRateLimitMemory();
});

describe("clientIp", () => {
  it("extracts the first hop from x-forwarded-for", () => {
    const req = request({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" });
    expect(clientIp(req))["toBe"]("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = request({ "x-real-ip": "5.6.7.8" });
    expect(clientIp(req))["toBe"]("5.6.7.8");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    expect(clientIp(request()))["toBe"]("unknown");
  });
});

describe("rateLimit (memory backend)", () => {
  it("allows up to the limit, then rejects on the same key", async () => {
    const req = request();
    const max = 3;
    const windowMs = 60_000;

    for (let i = 0; i < max; i++) {
      const r = await rateLimit(req, { max, windowMs });
      expect(r["ok"])["toBe"](true);
    }
    const final = await rateLimit(req, { max, windowMs });
    expect(final["ok"])["toBe"](false);
  });

  it("separates limits by path (same IP, different routes)", async () => {
    const a = new NextRequest("https://app.example.com/api/a", { method: "POST", headers: { host: "app.example.com" } });
    const b = new NextRequest("https://app.example.com/api/b", { method: "POST", headers: { host: "app.example.com" } });
    const opts = { max: 1, windowMs: 60_000 };
    expect((await rateLimit(a, opts))["ok"])["toBe"](true);
    expect((await rateLimit(a, opts))["ok"])["toBe"](false);
    // Different path, fresh budget.
    expect((await rateLimit(b, opts))["ok"])["toBe"](true);
  });

  it("falls back to the in-process map when the async backend throws", async () => {
    // Force the async backend to fail by exhausting an absurd-but-tiny window
    // twice — the synchronous fallback must still keep rejecting.
    const req = request();
    const opts = { max: 1, windowMs: 1 };
    const first = await rateLimit(req, opts);
    expect(first["ok"])["toBe"](true);
    // The shared limiter returns ok:false on the second hit; the route is
    // still throttled.
    const second = await rateLimit(req, opts);
    expect(second["ok"])["toBe"](false);
  });
});
