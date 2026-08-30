import { afterEach, describe, expect, it } from "vitest";
import { buildCsp, cspMode, crossOriginHeaders, generateNonce } from "@/lib/security-headers";

const originalEnv = { ...process["env"] };

afterEach(() => {
  process["env"] = { ...originalEnv };
});

/** Parse a CSP header into directive -> sources. */
function directives(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of csp["split"](";")) {
    const trimmed = part["trim"]();
    if (!trimmed) continue;
    const [name, ...sources] = trimmed["split"](/\s+/);
    out[name] = sources;
  }
  return out;
}

describe("generateNonce", () => {
  it("produces unique base64 nonces", () => {
    const nonces = new Set(Array["from"]({ length: 50 }, () => generateNonce()));
    expect(nonces["size"])["toBe"](50);
    for (const nonce of nonces) {
      expect(nonce)["toMatch"](/^[A-Za-z0-9+/]+={0,2}$/);
      // 16 random bytes -> 24 base64 characters.
      expect(nonce["length"])["toBe"](24);
    }
  });
});

describe("cspMode", () => {
  it("defaults to strict", () => {
    delete process["env"]["FF_CSP"];
    expect(cspMode())["toBe"]("strict");
  });

  it("falls back to compat on request", () => {
    process["env"]["FF_CSP"] = "compat";
    expect(cspMode())["toBe"]("compat");
    process["env"]["FF_CSP"] = "off";
    expect(cspMode())["toBe"]("compat");
  });
});

describe("buildCsp — strict mode in production", () => {
  function productionCsp(nonce = "test-nonce") {
    process["env"]["NODE_ENV"] = "production";
    process["env"]["FF_CSP"] = "strict";
    return directives(buildCsp(nonce));
  }

  it("removes unsafe-inline and unsafe-eval from script-src", () => {
    const scriptSrc = productionCsp()["script-src"];
    expect(scriptSrc)["not"]["toContain"]("'unsafe-inline'");
    expect(scriptSrc)["not"]["toContain"]("'unsafe-eval'");
  });

  it("carries the nonce and strict-dynamic", () => {
    const scriptSrc = productionCsp("abc123")["script-src"];
    expect(scriptSrc)["toContain"]("'nonce-abc123'");
    expect(scriptSrc)["toContain"]("'strict-dynamic'");
  });

  it("locks down the directives an XSS payload would reach for", () => {
    const parsed = productionCsp();
    expect(parsed["object-src"])["toEqual"](["'none'"]);
    expect(parsed["base-uri"])["toEqual"](["'self'"]);
    expect(parsed["frame-ancestors"])["toEqual"](["'none'"]);
    expect(parsed["default-src"])["toEqual"](["'self'"]);
  });

  it("upgrades insecure requests in production only", () => {
    expect(Object["keys"](productionCsp()))["toContain"]("upgrade-insecure-requests");

    process["env"]["NODE_ENV"] = "development";
    expect(Object["keys"](directives(buildCsp("n"))))["not"]["toContain"]("upgrade-insecure-requests");
  });

  it("still permits the third-party frames the app depends on", () => {
    const frameSrc = productionCsp()["frame-src"];
    expect(frameSrc)["toContain"]("https://*.stripe.com");
    expect(frameSrc)["toContain"]("https://accounts.google.com");
  });

  it("allows inline styles, which cannot carry a nonce", () => {
    expect(productionCsp()["style-src"])["toContain"]("'unsafe-inline'");
  });

  it("adds the error sink origin to connect-src when configured", () => {
    process["env"]["NODE_ENV"] = "production";
    process["env"]["SENTRY_DSN"] = "https://abc123@o1.ingest.sentry.io/456";
    expect(directives(buildCsp("n"))["connect-src"])["toContain"]("https://o1.ingest.sentry.io");
  });

  it("ignores a malformed sink URL rather than breaking the policy", () => {
    process["env"]["NODE_ENV"] = "production";
    process["env"]["ERROR_WEBHOOK_URL"] = "not a url";
    expect(() => buildCsp("n"))["not"]["toThrow"]();
  });
});

describe("buildCsp — development and compat", () => {
  it("permits eval in development for Fast Refresh", () => {
    process["env"]["NODE_ENV"] = "development";
    process["env"]["FF_CSP"] = "strict";
    const parsed = directives(buildCsp("n"));
    expect(parsed["script-src"])["toContain"]("'unsafe-eval'");
    expect(parsed["connect-src"])["toContain"]("wss:");
  });

  it("restores the permissive policy in compat mode", () => {
    process["env"]["NODE_ENV"] = "production";
    process["env"]["FF_CSP"] = "compat";
    const scriptSrc = directives(buildCsp("n"))["script-src"];
    expect(scriptSrc)["toContain"]("'unsafe-inline'");
    expect(scriptSrc)["toContain"]("'unsafe-eval'");
    expect(scriptSrc)["not"]["toContain"]("'strict-dynamic'");
  });
});

describe("crossOriginHeaders", () => {
  it("allows OAuth popups to keep their opener", () => {
    const headers = crossOriginHeaders();
    expect(headers["Cross-Origin-Opener-Policy"])["toBe"]("same-origin-allow-popups");
    expect(headers["Cross-Origin-Resource-Policy"])["toBe"]("same-origin");
  });

  it("leaves COEP off unless explicitly enabled", () => {
    delete process["env"]["FF_COEP"];
    expect(crossOriginHeaders())["not"]["toHaveProperty"]("Cross-Origin-Embedder-Policy");
  });

  it("enables COEP only for the two valid values", () => {
    for (const value of ["credentialless", "require-corp"]) {
      process["env"]["FF_COEP"] = value;
      expect(crossOriginHeaders()["Cross-Origin-Embedder-Policy"])["toBe"](value);
    }
    process["env"]["FF_COEP"] = "yes-please";
    expect(crossOriginHeaders())["not"]["toHaveProperty"]("Cross-Origin-Embedder-Policy");
  });
});
