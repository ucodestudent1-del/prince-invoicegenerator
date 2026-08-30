import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const ORIGIN = "https://app.example.com";

function makeRequest(path: string, options: { method?: string; headers?: Record<string, string> } = {}) {
  const { method = "GET", headers = {} } = options;
  const full = `${ORIGIN}${path}`;
  return new NextRequest(full, {
    method,
    headers: {
      host: "app.example.com",
      ...headers,
    },
  });
}

describe("middleware — security headers on documents", () => {
  it("adds a per-request CSP nonce and cross-origin headers", async () => {
    const previous = process["env"]["NODE_ENV"];
    process["env"]["NODE_ENV"] = "production";
    try {
      const res = await middleware(makeRequest("/en/dashboard"));
      // Static security headers (HSTS, X-Frame-Options, …) are applied by
      // next.config.mjs; the middleware owns the per-request CSP + COOP/COEP.
      expect(res["headers"]["get"]("Cross-Origin-Opener-Policy"))["toBe"]("same-origin-allow-popups");
      expect(res["headers"]["get"]("Cross-Origin-Resource-Policy"))["toBe"]("same-origin");

      const csp = res["headers"]["get"]("Content-Security-Policy") as string;
      expect(csp)["toContain"]("default-src 'self'");
      const scriptSrc = /script-src[^;]*/["exec"](csp)?.[0] ?? "";
      expect(scriptSrc)["toMatch"](/'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
      // Strict mode in production must not ship the eval escape.
      expect(scriptSrc)["not"]["toContain"]("'unsafe-eval'");
    } finally {
      process["env"]["NODE_ENV"] = previous;
    }
  });

  it("refreshes the CSRF cookie on document responses", async () => {
    const res = await middleware(makeRequest("/en/dashboard"));
    const setCookie = res["headers"]["getSetCookie"]?.() ?? [];
    const csrf = setCookie["find"]((c) => c["startsWith"]("csrf_token="));
    expect(csrf)["toBeTruthy"]();
    expect(csrf)["toMatch"](/SameSite=lax/i);
    expect(csrf)["toContain"]("Path=/");
  });
});

describe("middleware — locale handling", () => {
  it("redirects locale-less dashboard paths to the default locale", async () => {
    const res = await middleware(makeRequest("/dashboard"));
    expect(res["status"])["toBe"](307);
    const location = res["headers"]["get"]("location") ?? "";
    expect(location)["toContain"]("/en/dashboard");
  });

  it("does not force a locale on portal paths", async () => {
    const res = await middleware(makeRequest("/portal/invoices/abc"));
    expect(res["status"])["not"]["toBe"](307);
    expect(res["headers"]["get"]("location"))["toBeNull"]();
  });
});

describe("middleware — correlation ID", () => {
  it("generates a request id and echoes it on the response", async () => {
    const res = await middleware(makeRequest("/api/health"));
    const id = res["headers"]["get"]("x-request-id");
    expect(id)["toBeTruthy"]();
    expect(id)["toMatch"](/^[0-9a-f]{1,}$/);
  });

  it("reuses an upstream request id when present", async () => {
    const res = await middleware(
      makeRequest("/api/health", { headers: { "x-request-id": "upstream-42" } })
    );
    expect(res["headers"]["get"]("x-request-id"))["toBe"]("upstream-42");
  });
});

describe("middleware — CSRF enforcement (enforce mode)", () => {
  const SESSION = "next-auth.session-token=authed-user-value";

  it("rejects a credentialed cross-site POST", async () => {
    const res = await middleware(
      makeRequest("/api/addresses", {
        method: "POST",
        headers: {
          cookie: SESSION,
          "sec-fetch-site": "cross-site",
          origin: "https://evil.example",
        },
      })
    );
    expect(res["status"])["toBe"](403);
    const body = await res["json"]();
    expect(body["error"])["toMatch"](/CSRF/i);
  });

  it("allows a same-site credentialed POST", async () => {
    const res = await middleware(
      makeRequest("/api/addresses", {
        method: "POST",
        headers: {
          cookie: SESSION,
          "sec-fetch-site": "same-origin",
          origin: ORIGIN,
        },
      })
    );
    expect(res["status"])["not"]["toBe"](403);
  });

  it("accepts a double-submit token that matches the cookie", async () => {
    const token = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5";
    const res = await middleware(
      makeRequest("/api/addresses", {
        method: "POST",
        headers: {
          cookie: `next-auth.session-token=authed-user-value; csrf_token=${token}`,
          "x-csrf-token": token,
          "sec-fetch-site": "cross-site",
          origin: "https://evil.example",
        },
      })
    );
    expect(res["status"])["not"]["toBe"](403);
  });

  it("does not block unauthenticated POSTs (no credentials to ride on)", async () => {
    const res = await middleware(
      makeRequest("/api/estimates/accept", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site", origin: "https://evil.example" },
      })
    );
    expect(res["status"])["not"]["toBe"](403);
  });

  it("never blocks NextAuth or signed webhook routes", async () => {
    for (const path of ["/api/auth/session", "/api/stripe/webhook", "/api/email/webhook"]) {
      const res = await middleware(
        makeRequest(path, {
          method: "POST",
          headers: { "sec-fetch-site": "cross-site", origin: "https://evil.example" },
        })
      );
      expect(res["status"], path)["not"]["toBe"](403);
    }
  });
});
