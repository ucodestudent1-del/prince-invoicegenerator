/**
 * Per-IP request rate limiting for API routes (Plan 2.2).
 *
 * Backed by the shared limiter in `action-rate-limit`, so it uses Redis when
 * configured and the in-process map otherwise.
 *
 * Failure semantics: if Redis (or anything else inside the limiter) throws,
 * the request is **not** silently allowed — it is still rate-limited by the
 * in-process map. The fallback is `best-effort per-instance`, but it is
 * always present, so a transient outage never turns into a free-for-all.
 *
 * `rateLimit` is async. Callers MUST await it.
 */

import type { NextRequest } from "next/server";
import { consumeRateLimit, checkRateLimitSync } from "@/lib/action-rate-limit";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

/** Best-effort client IP from the usual proxy headers. */
export function clientIp(req: NextRequest | Request): string {
  const headers = req["headers"];
  const forwarded = headers["get"]("x-forwarded-for");
  if (forwarded) {
    const first = forwarded["split"](",")[0]?.["trim"]();
    if (first) return first;
  }
  return (
    headers["get"]("x-real-ip") ||
    headers["get"]("cf-connecting-ip") ||
    headers["get"]("x-vercel-forwarded-for") ||
    "unknown"
  );
}

export async function rateLimit(
  req: NextRequest,
  options?: { max?: number; windowMs?: number }
): Promise<{ ok: boolean; remaining: number; resetAt: number }> {
  const max = options?.["max"] ?? RATE_LIMIT_MAX;
  const windowMs = options?.["windowMs"] ?? RATE_LIMIT_WINDOW_MS;
  const ip = clientIp(req);
  const pathname =
    (req as NextRequest)["nextUrl"]?.["pathname"] || req["headers"]["get"]("x-pathname") || "/";
  const key = `ip:${ip}:${pathname}`;

  // First try the shared (Redis-aware) limiter. It already falls back to the
  // in-process map when Redis is missing, so most paths never throw.
  try {
    const result = await consumeRateLimit(key, max, windowMs);
    return { ok: result["ok"], remaining: result["remaining"], resetAt: result["resetAt"] };
  } catch {
    // Anything thrown by the async backend (network error, Redis crashed,
    // JSON parse failure on the wire…) lands here. Run the synchronous
    // in-process map so the route is still throttled.
    const allowed = checkRateLimitSync(key, max, windowMs);
    return {
      ok: allowed,
      remaining: allowed ? Math["max"](0, max - 1) : 0,
      resetAt: Date["now"]() + windowMs,
    };
  }
}
