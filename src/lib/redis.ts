/**
 * Minimal Redis client over the Upstash REST API (Plan 2.2).
 *
 * Deliberately dependency-free: it speaks the documented REST/pipeline protocol
 * with `fetch`, so it works in both the Node and Edge runtimes without adding
 * `ioredis` or `@upstash/redis` to the bundle.
 *
 * Entirely env-gated. When `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
 * are absent every call resolves to `null` and callers fall back to their
 * in-process behaviour.
 */

import { logWarn } from "@/lib/logging";

/** Consecutive failures before the client trips its breaker. */
const FAILURE_THRESHOLD = 3;
/** How long the breaker stays open before probing Redis again. */
const BREAKER_COOLDOWN_MS = 60_000;
/** Upper bound on a single Redis round trip. */
const REQUEST_TIMEOUT_MS = 1500;

let consecutiveFailures = 0;
let breakerOpenUntil = 0;

export type RedisCommand = (string | number)[];

function restUrl(): string | undefined {
  const url = process["env"]["UPSTASH_REDIS_REST_URL"] || process["env"]["REDIS_REST_URL"];
  return url ? url["replace"](/\/+$/, "") : undefined;
}

function restToken(): string | undefined {
  return process["env"]["UPSTASH_REDIS_REST_TOKEN"] || process["env"]["REDIS_REST_TOKEN"];
}

/** True when Redis credentials are present in the environment. */
export function isRedisConfigured(): boolean {
  return Boolean(restUrl() && restToken());
}

/**
 * True when Redis is configured *and* the circuit breaker is closed, i.e. the
 * next call is expected to succeed.
 */
export function isRedisAvailable(): boolean {
  return isRedisConfigured() && Date["now"]() >= breakerOpenUntil;
}

function recordSuccess() {
  consecutiveFailures = 0;
  breakerOpenUntil = 0;
}

function recordFailure(err: unknown) {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_THRESHOLD && Date["now"]() >= breakerOpenUntil) {
    breakerOpenUntil = Date["now"]() + BREAKER_COOLDOWN_MS;
    logWarn("redis", "Redis unreachable — falling back to in-memory behaviour", {
      cooldownMs: BREAKER_COOLDOWN_MS,
      reason: err instanceof Error ? err["message"] : String(err),
    });
  }
}

/**
 * Execute a pipeline of Redis commands in a single round trip.
 * Returns `null` when Redis is unconfigured, unavailable, or the call fails —
 * callers must treat `null` as "no Redis, use the fallback".
 */
export async function redisPipeline(commands: RedisCommand[]): Promise<unknown[] | null> {
  const url = restUrl();
  const token = restToken();
  if (!url || !token) return null;
  if (Date["now"]() < breakerOpenUntil) return null;
  if (commands["length"] === 0) return [];
  if (typeof fetch !== "function") return null;

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON["stringify"](commands),
      cache: "no-store",
      signal: timeoutSignal(REQUEST_TIMEOUT_MS),
    });

    if (!res["ok"]) {
      recordFailure(new Error(`Redis pipeline returned HTTP ${res["status"]}`));
      return null;
    }

    const body = (await res["json"]()) as { result?: unknown; error?: string }[];
    if (!Array["isArray"](body)) {
      recordFailure(new Error("Redis pipeline returned an unexpected payload"));
      return null;
    }

    recordSuccess();
    return body["map"]((entry) => (entry && "error" in entry && entry["error"] ? null : entry?.["result"] ?? null));
  } catch (err) {
    recordFailure(err);
    return null;
  }
}

/** Execute a single Redis command. Returns `null` when Redis is unavailable. */
export async function redisCommand(command: RedisCommand): Promise<unknown> {
  const results = await redisPipeline([command]);
  return results ? results[0] : null;
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  try {
    return AbortSignal["timeout"](ms);
  } catch {
    return undefined;
  }
}
