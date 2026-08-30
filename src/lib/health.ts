/**
 * Health-check logic, extracted from the route so it can be unit-tested without
 * mocking the database or Stripe modules (Plan 2.9 / observability).
 *
 * `buildHealthResponse` is a pure async function: it receives its dependencies
 * explicitly and returns `{ status, body }`. The route handler in
 * `src/app/api/health/route.ts` is a thin adapter that injects the real
 * implementations.
 *
 * Two probe depths:
 * - `?probe=liveness` — process-only; for a container HEALTHCHECK.
 * - default (readiness) — verifies the database, Stripe and schema integrity.
 *
 * Diagnostic detail (error strings, schema column names, memory) is only
 * returned to callers that pass `isAuthorized(req)`. Anonymous callers get
 * pass/fail booleans, so the endpoint stays a safe load-balancer probe without
 * leaking internals — the previous version published schema column names to
 * anyone who asked.
 */

export type HealthCheckResult = { ok: boolean; error?: string };

export type HealthDependencies = {
  checkDatabase: () => Promise<HealthCheckResult>;
  /** Verify schema integrity; returns ok:false when columns are missing. */
  checkSchema: () => Promise<HealthCheckResult>;
  /** Probe Stripe when configured; resolves to null when not configured. */
  checkStripe: () => Promise<HealthCheckResult | null>;
  isAuthorized: (req: Request | { headers?: { get?: (name: string) => string | null } }) => boolean;
  isRedisConfigured: () => boolean;
  isRedisAvailable: () => boolean;
  errorTrackingConfigured: () => boolean;
  getRequestId: () => string | undefined;
};

const startedAt = Date["now"]();

export async function buildHealthResponse(
  req: { url?: string; headers?: { get?: (name: string) => string | null } },
  deps: HealthDependencies
): Promise<{ status: number; body: Record<string, unknown> }> {
  const url = new URL(req["url"] ?? "http://localhost/api/health");
  const probe = url["searchParams"]["get"]("probe");
  const requestId = deps["getRequestId"]();

  if (probe === "liveness") {
    return {
      status: 200,
      body: {
        ok: true,
        probe: "liveness",
        uptimeSeconds: Math["round"]((Date["now"]() - startedAt) / 1000),
        timestamp: new Date()["toISOString"](),
        ...(requestId ? { requestId } : {}),
      },
    };
  }

  const detailed = deps["isAuthorized"](req);

  const checks: Record<string, HealthCheckResult> = {};
  const dbResult = await runGuardedAsync(deps["checkDatabase"]);
  if (dbResult) checks["database"] = dbResult;

  const stripe = await runGuardedAsync(deps["checkStripe"]);
  if (stripe !== null) {
    checks["stripe"] = stripe;
  }

  if (checks["database"]["ok"]) {
    const schemaResult = await runGuardedAsync(deps["checkSchema"]);
    if (schemaResult) checks["schema"] = schemaResult;
  }

  const finalOk = Object["values"](checks)["every"]((c) => c["ok"]);

  const body: Record<string, unknown> = {
    ok: finalOk,
    probe: "readiness",
    checks: detailed
      ? checks
      : Object["fromEntries"](
          Object["entries"](checks)["map"](([key, value]) => [key, { ok: value["ok"] }])
        ),
    timestamp: new Date()["toISOString"](),
  };

  if (requestId) body["requestId"] = requestId;

  if (detailed) {
    body["runtime"] = {
      uptimeSeconds: Math["round"]((Date["now"]() - startedAt) / 1000),
      memory: memoryUsage(),
      nodeVersion: process["version"],
      release:
        process["env"]["APP_RELEASE"] || process["env"]["RAILWAY_GIT_COMMIT_SHA"] || null,
    };
    body["dependencies"] = {
      rateLimiter: deps["isRedisConfigured"]()
        ? deps["isRedisAvailable"]() ? "redis" : "redis-degraded"
        : "memory",
      errorTracking: deps["errorTrackingConfigured"]() ? "configured" : "none",
    };
  }

  return { status: finalOk ? 200 : 503, body };
}

async function runGuardedAsync(
  fn: () => Promise<HealthCheckResult | null>
): Promise<HealthCheckResult | null> {
  try {
    return await fn();
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err["message"] : String(err);
}

function memoryUsage() {
  try {
    const usage = process["memoryUsage"]();
    const toMb = (bytes: number) => Math["round"]((bytes / 1024 / 1024) * 10) / 10;
    return {
      rssMb: toMb(usage["rss"]),
      heapUsedMb: toMb(usage["heapUsed"]),
      heapTotalMb: toMb(usage["heapTotal"]),
      heapUtilization:
        usage["heapTotal"] > 0
          ? Math["round"]((usage["heapUsed"] / usage["heapTotal"]) * 100) / 100
          : null,
    };
  } catch {
    return null;
  }
}
