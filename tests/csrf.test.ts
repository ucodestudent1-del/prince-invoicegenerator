import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { CSRF_COOKIE, CSRF_HEADER, csrfMode, generateCsrfToken, verifyCsrf } from "@/lib/csrf";

const ORIGIN = "https://app.example.com";
const SESSION_COOKIE = "next-auth.session-token";

function request(
  options: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = "POST", path = "/api/addresses", headers = {}, cookies = {} } = options;

  const cookieHeader = Object["entries"](cookies)
    ["map"](([key, value]) => `${key}=${value}`)
    ["join"]("; ");

  const merged: Record<string, string> = {
    host: "app.example.com",
    ...headers,
  };
  if (cookieHeader) merged["cookie"] = cookieHeader;

  return new NextRequest(`${ORIGIN}${path}`, { method, headers: merged });
}

/** A request that carries ambient credentials, i.e. one worth forging. */
function authenticated(options: Parameters<typeof request>[0] = {}) {
  return request({
    ...options,
    cookies: { [SESSION_COOKIE]: "session-value", ...(options["cookies"] ?? {}) },
  });
}

describe("csrfMode", () => {
  it("enforces by default", () => {
    const previous = process["env"]["FF_CSRF"];
    delete process["env"]["FF_CSRF"];
    expect(csrfMode())["toBe"]("enforce");
    process["env"]["FF_CSRF"] = previous;
  });

  it("honours the off and report escape hatches", () => {
    const previous = process["env"]["FF_CSRF"];
    for (const value of ["off", "false", "0"]) {
      process["env"]["FF_CSRF"] = value;
      expect(csrfMode())["toBe"]("off");
    }
    process["env"]["FF_CSRF"] = "report";
    expect(csrfMode())["toBe"]("report");
    process["env"]["FF_CSRF"] = previous;
  });
});

describe("generateCsrfToken", () => {
  it("produces unique 48-character hex tokens", () => {
    const tokens = new Set(Array["from"]({ length: 50 }, () => generateCsrfToken()));
    expect(tokens["size"])["toBe"](50);
    for (const token of tokens) {
      expect(token)["toMatch"](/^[0-9a-f]{48}$/);
    }
  });
});

describe("verifyCsrf — requests that are not checked", () => {
  it("skips safe methods", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const result = verifyCsrf(authenticated({ method, headers: { "sec-fetch-site": "cross-site" } }));
      expect(result)["toMatchObject"]({ ok: true, skipped: true });
    }
  });

  it("skips NextAuth routes, which carry their own CSRF token", () => {
    const result = verifyCsrf(
      authenticated({ path: "/api/auth/callback/google", headers: { "sec-fetch-site": "cross-site" } })
    );
    expect(result)["toMatchObject"]({ ok: true, reason: "exempt-path" });
  });

  it("skips signature-verified webhooks", () => {
    for (const path of ["/api/stripe/webhook", "/api/email/webhook"]) {
      const result = verifyCsrf(request({ path, headers: { "sec-fetch-site": "cross-site" } }));
      expect(result)["toMatchObject"]({ ok: true, reason: "exempt-path" });
    }
  });

  it("skips header-authenticated background jobs", () => {
    const result = verifyCsrf(
      request({ path: "/api/reminders/check", headers: { "x-api-key": "job-key" } })
    );
    expect(result)["toMatchObject"]({ ok: true, reason: "header-authenticated" });
  });

  it("skips requests with no session cookie — there is nothing to forge", () => {
    const result = verifyCsrf(request({ headers: { "sec-fetch-site": "cross-site" } }));
    expect(result)["toMatchObject"]({ ok: true, reason: "unauthenticated" });
  });
});

describe("verifyCsrf — double-submit cookie", () => {
  it("accepts a header that matches the cookie", () => {
    const token = generateCsrfToken();
    const result = verifyCsrf(
      authenticated({
        headers: { [CSRF_HEADER]: token, "sec-fetch-site": "cross-site" },
        cookies: { [CSRF_COOKIE]: token },
      })
    );
    // The matching token wins even though Sec-Fetch-Site says cross-site,
    // because only same-origin script could have read the cookie.
    expect(result["ok"])["toBe"](true);
  });

  it("rejects a header that does not match the cookie", () => {
    const result = verifyCsrf(
      authenticated({
        headers: { [CSRF_HEADER]: generateCsrfToken() },
        cookies: { [CSRF_COOKIE]: generateCsrfToken() },
      })
    );
    expect(result)["toMatchObject"]({ ok: false, reason: "csrf-token-mismatch" });
  });

  it("rejects a header when no cookie was issued", () => {
    const result = verifyCsrf(authenticated({ headers: { [CSRF_HEADER]: generateCsrfToken() } }));
    expect(result)["toMatchObject"]({ ok: false, reason: "csrf-cookie-missing" });
  });

  it("rejects a token of the right length but wrong value", () => {
    const token = generateCsrfToken();
    const tampered = `${token["slice"](0, -1)}${token["endsWith"]("a") ? "b" : "a"}`;
    const result = verifyCsrf(
      authenticated({ headers: { [CSRF_HEADER]: tampered }, cookies: { [CSRF_COOKIE]: token } })
    );
    expect(result["ok"])["toBe"](false);
  });
});

describe("verifyCsrf — origin validation", () => {
  it("accepts same-origin fetches", () => {
    const result = verifyCsrf(authenticated({ headers: { "sec-fetch-site": "same-origin" } }));
    expect(result["ok"])["toBe"](true);
  });

  it("accepts direct user navigation", () => {
    const result = verifyCsrf(authenticated({ headers: { "sec-fetch-site": "none" } }));
    expect(result["ok"])["toBe"](true);
  });

  it("rejects cross-site and same-site (subdomain) requests", () => {
    for (const site of ["cross-site", "same-site"]) {
      const result = verifyCsrf(authenticated({ headers: { "sec-fetch-site": site } }));
      expect(result)["toMatchObject"]({ ok: false, reason: `sec-fetch-site:${site}` });
    }
  });

  it("falls back to Origin when Sec-Fetch-Site is absent", () => {
    expect(verifyCsrf(authenticated({ headers: { origin: ORIGIN } }))["ok"])["toBe"](true);
    expect(verifyCsrf(authenticated({ headers: { origin: "https://evil.example" } })))["toMatchObject"]({
      ok: false,
      reason: "origin-mismatch",
    });
  });

  it("accepts the proxy-forwarded host", () => {
    const result = verifyCsrf(
      authenticated({
        headers: { origin: "https://custom.example", "x-forwarded-host": "custom.example" },
      })
    );
    expect(result["ok"])["toBe"](true);
  });

  it("falls back to Referer when Origin is absent", () => {
    expect(verifyCsrf(authenticated({ headers: { referer: `${ORIGIN}/en/dashboard` } }))["ok"])["toBe"](
      true
    );
    expect(
      verifyCsrf(authenticated({ headers: { referer: "https://evil.example/attack" } }))
    )["toMatchObject"]({ ok: false, reason: "referer-mismatch" });
  });

  it("rejects a credentialed mutation with no provenance headers at all", () => {
    const result = verifyCsrf(authenticated({ headers: { host: "app.example.com" } }));
    expect(result)["toMatchObject"]({ ok: false, reason: "origin-missing" });
  });

  it("fails closed on an internal fault (e.g. malformed URL)", () => {
    // Force `evaluate` to throw by handing it a request whose `nextUrl`
    // throws when its pathname is read. With the new contract, an internal
    // fault is a rejection, not a silent allow.
    const faulty = {
      method: "POST",
      headers: new Headers(),
      cookies: { get: () => undefined },
      nextUrl: {
        get pathname() {
          throw new Error("boom");
        },
      },
    } as unknown as NextRequest;
    const result = verifyCsrf(faulty);
    expect(result["ok"])["toBe"](false);
    expect(result["reason"])["toBe"]("internal-fault");
  });

  it("covers every state-changing method", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const result = verifyCsrf(
        authenticated({ method, headers: { "sec-fetch-site": "cross-site" } })
      );
      expect(result["ok"], `${method} should be rejected`)["toBe"](false);
    }
  });
});
