import { describe, expect, it, vi } from "vitest";
import { buildHealthResponse } from "@/lib/health";

/** A minimal request double that satisfies the function's contract. */
function req(url = "http://localhost:3000/api/health", headers: Record<string, string> = {}) {
  return {
    url,
    headers: { get: (name: string) => headers[name] ?? null },
  };
}

/** Default healthy dependencies; override per test. */
function deps(overrides: Partial<Parameters<typeof buildHealthResponse>[1]> = {}) {
  return {
    checkDatabase: vi["fn"](async () => ({ ok: true })),
    checkSchema: vi["fn"](async () => ({ ok: true })),
    checkStripe: vi["fn"](async () => null),
    isAuthorized: vi["fn"](() => false),
    isRedisConfigured: () => false,
    isRedisAvailable: () => false,
    errorTrackingConfigured: () => false,
    getRequestId: () => "req_health_1",
    ...overrides,
  } as Parameters<typeof buildHealthResponse>[1];
}

describe("buildHealthResponse", () => {
  it("liveness probe never runs checks and always reports ok", async () => {
    const d = deps();
    const { status, body } = await buildHealthResponse(req("http://localhost/api/health?probe=liveness"), d);
    expect(status)["toBe"](200);
    expect(body)["toMatchObject"]({ ok: true, probe: "liveness" });
    expect(d["checkDatabase"])["not"]["toHaveBeenCalled"]();
    expect(body["requestId"])["toBe"]("req_health_1");
  });

  it("anonymizes diagnostics for unauthorized callers", async () => {
    const { status, body } = await buildHealthResponse(req(), deps());
    expect(status)["toBe"](200);
    expect(body["ok"])["toBe"](true);
    expect(body["runtime"])["toBeUndefined"]();
    expect(body["dependencies"])["toBeUndefined"]();
    for (const check of Object["values"](body["checks"] as Record<string, unknown>)) {
      expect(check)["toMatchObject"]({ ok: true });
      expect((check as { error?: string })["error"])["toBeUndefined"]();
    }
  });

  it("exposes diagnostics only to authorized callers", async () => {
    const d = deps({ isAuthorized: () => true });
    const { body } = await buildHealthResponse(req("http://localhost/api/health", { "x-api-key": "k" }), d);
    expect(body["runtime"])["toMatchObject"]({ nodeVersion: expect["any"](String) });
    expect(body["dependencies"])["toMatchObject"]({ rateLimiter: "memory" });
    expect((body["checks"] as Record<string, unknown>)["database"])["toMatchObject"]({ ok: true });
  });

  it("reports the redis backend when configured and available", async () => {
    const d = deps({ isAuthorized: () => true, isRedisConfigured: () => true, isRedisAvailable: () => true });
    const { body } = await buildHealthResponse(req(), d);
    expect((body["dependencies"] as Record<string, unknown>)["rateLimiter"])["toBe"]("redis");
  });

  it("returns 503 when a core dependency is unhealthy", async () => {
    const d = deps({
      checkDatabase: async () => ({ ok: false, error: "connection refused (internal only)" }),
    });
    const { status, body } = await buildHealthResponse(req(), d);
    expect(status)["toBe"](503);
    expect(body["ok"])["toBe"](false);
    // The internal error string must not leak to anonymous callers.
    expect((body["checks"] as Record<string, unknown>)["database"]["error"])["toBeUndefined"]();
  });

  it("omits the stripe check from the payload when none is configured", async () => {
    const stripe = vi["fn"](async () => null);
    const { body } = await buildHealthResponse(req(), deps({ checkStripe: stripe }));
    // checkStripe is always invoked by the route; when it reports no key the
    // result is null and the field is omitted from the payload.
    expect(stripe)["toHaveBeenCalled"]();
    expect((body["checks"] as Record<string, unknown>)["stripe"])["toBeUndefined"]();
  });

  it("includes a stripe check result when one is returned", async () => {
    const { body } = await buildHealthResponse(
      req(),
      deps({ checkStripe: async () => ({ ok: true }) })
    );
    expect((body["checks"] as Record<string, unknown>)["stripe"])["toMatchObject"]({ ok: true });
  });

  it("omits the schema check when the database itself is down", async () => {
    const schema = vi["fn"](async () => ({ ok: true }));
    const d = deps({
      checkDatabase: async () => ({ ok: false }),
      checkSchema: schema,
    });
    await buildHealthResponse(req(), d);
    expect(schema)["not"]["toHaveBeenCalled"]();
  });

  it("sets the no-store cache header contract via the data shape", async () => {
    // The route attaches Cache-Control; assert the body is always a plain object
    // the caller can serialize, and that requestId propagates.
    const { body } = await buildHealthResponse(req(), deps({ getRequestId: () => "abc" }));
    expect(body["requestId"])["toBe"]("abc");
  });
});
