/**
 * Keyed rate limiting for server actions and API routes (Plan 2.2).
 *
 * Uses Redis when `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are
 * configured so limits are shared across every instance and survive restarts.
 * Without Redis — or when Redis is unreachable — it transparently degrades to
 * the previous per-process `Map`, which is still correct for single-instance
 * deployments.
 *
 * `checkRateLimit` is async. Callers MUST await it; a forgotten `await` would
 * always evaluate truthy and silently disable the limit.
 */

import { isRedisAvailable, redisCommand, redisPipeline } from "@/lib/redis";

type Entry = { count: number; reset: number };

const hits = new Map<string, Entry>();

/** Bound the in-memory map so a hostile key space cannot exhaust memory. */
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Epoch milliseconds at which the current window expires. */
  resetAt: number;
  /** Which backend answered — useful for health checks and tests. */
  backend: "redis" | "memory";
};

function pruneMemory(now: number) {
  for (const [key, entry] of hits["entries"]()) {
    if (now > entry["reset"]) hits["delete"](key);
  }
  if (hits["size"] > MAX_TRACKED_KEYS) {
    // Oldest-inserted keys first: Map preserves insertion order.
    const excess = hits["size"] - MAX_TRACKED_KEYS;
    let removed = 0;
    for (const key of hits["keys"]()) {
      hits["delete"](key);
      if (++removed >= excess) break;
    }
  }
}

/**
 * Synchronous in-memory limiter. Retained as the fallback path and for callers
 * that cannot await (none at present).
 */
export function checkRateLimitSync(key: string, max: number, windowMs: number): boolean {
  return consumeMemory(key, max, windowMs)["ok"];
}

function consumeMemory(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date["now"]();
  pruneMemory(now);
  const entry = hits["get"](key);

  if (!entry || now > entry["reset"]) {
    const reset = now + windowMs;
    hits["set"](key, { count: 1, reset });
    return { ok: true, remaining: Math["max"](0, max - 1), resetAt: reset, backend: "memory" };
  }

  entry["count"] += 1;
  if (entry["count"] > max) {
    return { ok: false, remaining: 0, resetAt: entry["reset"], backend: "memory" };
  }
  return {
    ok: true,
    remaining: Math["max"](0, max - entry["count"]),
    resetAt: entry["reset"],
    backend: "memory",
  };
}

/**
 * Consume one token from the window identified by `key`.
 * Returns the full result so callers can surface `Retry-After` headers.
 */
export async function consumeRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (!isRedisAvailable()) {
    return consumeMemory(key, max, windowMs);
  }

  const redisKey = `rl:${key}`;
  const results = await redisPipeline([
    ["INCR", redisKey],
    ["PTTL", redisKey],
  ]);

  if (!results || results[0] === null || results[0] === undefined) {
    return consumeMemory(key, max, windowMs);
  }

  const count = Number(results[0]);
  if (!Number["isFinite"](count)) {
    return consumeMemory(key, max, windowMs);
  }

  let ttl = Number(results[1]);
  if (!Number["isFinite"](ttl) || ttl < 0) {
    // First hit in this window (or a key that lost its TTL): (re)arm expiry.
    void redisCommand(["PEXPIRE", redisKey, windowMs]);
    ttl = windowMs;
  }

  return {
    ok: count <= max,
    remaining: Math["max"](0, max - count),
    resetAt: Date["now"]() + ttl,
    backend: "redis",
  };
}

/**
 * Returns `true` when the caller is within its limit, `false` when throttled.
 * Fails open on unexpected errors so a limiter outage cannot take the app down.
 */
export async function checkRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  try {
    const result = await consumeRateLimit(key, max, windowMs);
    return result["ok"];
  } catch {
    return true;
  }
}

/** Test seam: drop all in-memory windows. */
export function resetRateLimitMemory() {
  hits["clear"]();
}
