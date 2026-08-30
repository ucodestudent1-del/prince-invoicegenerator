/**
 * Per-IP request rate limiting for API routes (Plan 2.2).
 *
 * Backed by the shared limiter in `action-rate-limit`, so it uses Redis when
 * configured and the in-process map otherwise.
 *
 * `rateLimit` is async. Callers MUST await it.
 */

import type { NextRequest } from "next/server";
import { consumeRateLimit } from "@/lib/action-rate-limit";

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
  try {
    const ip = clientIp(req);
    const pathname =
      (req as NextRequest)["nextUrl"]?.["pathname"] || req["headers"]["get"]("x-pathname") || "/";
    const result = await consumeRateLimit(`ip:${ip}:${pathname}`, max, windowMs);
    return { ok: result["ok"], remaining: result["remaining"], resetAt: result["resetAt"] };
  } catch {
    // Fail open: a limiter fault must not block legitimate traffic.
    return { ok: true, remaining: max, resetAt: Date["now"]() + windowMs };
  }
}
