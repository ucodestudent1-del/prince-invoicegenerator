/**
 * CSRF protection for state-changing requests (Plan 1.3).
 *
 * Two complementary defences, both enforced in `src/middleware.ts`:
 *
 * 1. **Origin validation** — the primary defence. Cookie-authenticated
 *    mutations must originate from this site, proven via `Sec-Fetch-Site` or a
 *    same-origin `Origin`/`Referer`. Browsers set these headers automatically
 *    and forbid scripts from overriding them, so no client changes are needed.
 * 2. **Double-submit cookie** — defence in depth. The middleware issues a
 *    readable `csrf_token` cookie; whenever a client echoes it in the
 *    `x-csrf-token` header the two values must match. See `csrf-client.ts`.
 *
 * Requests that carry no session cookie are skipped: with no ambient
 * credentials to ride on there is nothing for an attacker to forge.
 *
 * Edge-safe — no Node built-ins are imported.
 */

import type { NextRequest } from "next/server";

export const CSRF_COOKIE = "csrf_token";
export const CSRF_HEADER = "x-csrf-token";
export const CSRF_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12;

/** `off` disables the check, `report` logs violations only, `enforce` blocks. */
export type CsrfMode = "off" | "report" | "enforce";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Paths that authenticate by other means and must not be blocked:
 * - NextAuth ships its own CSRF token for `/api/auth/*`.
 * - Stripe and email webhooks are verified by request signature.
 */
const EXEMPT_PREFIXES = ["/api/auth/", "/api/stripe/webhook", "/api/email/webhook"];

/** Session cookies that make a request "credentialed" and therefore forgeable. */
const SESSION_COOKIES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export type CsrfResult = {
  ok: boolean;
  /** True when the request was not subject to CSRF checks at all. */
  skipped: boolean;
  /** Machine-readable rejection reason, for logs. */
  reason?: string;
};

export function csrfMode(): CsrfMode {
  const raw = (process["env"]["FF_CSRF"] || "")["toLowerCase"]()["trim"]();
  if (raw === "off" || raw === "false" || raw === "0") return "off";
  if (raw === "report") return "report";
  return "enforce";
}

/** Generate a fresh, URL-safe CSRF token. */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(24);
  try {
    globalThis["crypto"]["getRandomValues"](bytes);
  } catch {
    for (let i = 0; i < bytes["length"]; i++) bytes[i] = Math["floor"](Math["random"]() * 256);
  }
  return Array["from"](bytes)
    ["map"]((b) => b["toString"](16)["padStart"](2, "0"))
    ["join"]("");
}

/**
 * Validate a request. Never throws — an internal fault resolves to `ok: true`
 * so a bug here cannot lock every user out of the application.
 */
export function verifyCsrf(request: NextRequest): CsrfResult {
  try {
    return evaluate(request);
  } catch {
    return { ok: true, skipped: true, reason: "check-failed-open" };
  }
}

function evaluate(request: NextRequest): CsrfResult {
  const method = (request["method"] || "GET")["toUpperCase"]();
  if (SAFE_METHODS["has"](method)) return { ok: true, skipped: true };

  const pathname = request["nextUrl"]?.["pathname"] || "/";
  if (EXEMPT_PREFIXES["some"]((prefix) => pathname["startsWith"](prefix))) {
    return { ok: true, skipped: true, reason: "exempt-path" };
  }

  // Background jobs and webhooks authenticate with a header a cross-site
  // attacker cannot set without a CORS preflight that this app never grants.
  if (request["headers"]["get"]("x-api-key") || request["headers"]["get"]("stripe-signature")) {
    return { ok: true, skipped: true, reason: "header-authenticated" };
  }

  // ---- Double-submit cookie -------------------------------------------------
  const headerToken = request["headers"]["get"](CSRF_HEADER);
  if (headerToken) {
    const cookieToken = request["cookies"]["get"](CSRF_COOKIE)?.["value"];
    if (!cookieToken) return { ok: false, skipped: false, reason: "csrf-cookie-missing" };
    if (!constantTimeEquals(cookieToken, headerToken)) {
      return { ok: false, skipped: false, reason: "csrf-token-mismatch" };
    }
    return { ok: true, skipped: false };
  }

  // ---- Origin validation ---------------------------------------------------
  if (!isCredentialed(request)) {
    return { ok: true, skipped: true, reason: "unauthenticated" };
  }

  const fetchSite = request["headers"]["get"]("sec-fetch-site");
  if (fetchSite) {
    // "none" means a direct user action (bookmark, typed URL), not a
    // cross-document request, so it cannot be attacker-initiated.
    if (fetchSite === "same-origin" || fetchSite === "none") return { ok: true, skipped: false };
    return { ok: false, skipped: false, reason: `sec-fetch-site:${fetchSite}` };
  }

  const allowed = allowedHosts(request);
  const origin = request["headers"]["get"]("origin");
  if (origin) {
    return hostOf(origin) && allowed["has"](hostOf(origin) as string)
      ? { ok: true, skipped: false }
      : { ok: false, skipped: false, reason: "origin-mismatch" };
  }

  const referer = request["headers"]["get"]("referer");
  if (referer) {
    return hostOf(referer) && allowed["has"](hostOf(referer) as string)
      ? { ok: true, skipped: false }
      : { ok: false, skipped: false, reason: "referer-mismatch" };
  }

  return { ok: false, skipped: false, reason: "origin-missing" };
}

function isCredentialed(request: NextRequest): boolean {
  return SESSION_COOKIES["some"]((name) => Boolean(request["cookies"]["get"](name)?.["value"]));
}

/**
 * Hosts considered "this site". Includes the forwarded host so the check works
 * behind Railway's proxy, plus any explicit allowlist for multi-domain setups.
 */
function allowedHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>();
  const forwarded = request["headers"]["get"]("x-forwarded-host");
  if (forwarded) {
    for (const entry of forwarded["split"](",")) {
      const host = entry["trim"]()["toLowerCase"]();
      if (host) hosts["add"](host);
    }
  }
  const host = request["headers"]["get"]("host");
  if (host) hosts["add"](host["toLowerCase"]());

  const configured = [
    process["env"]["NEXT_PUBLIC_BASE_URL"],
    process["env"]["NEXTAUTH_URL"],
    ...(process["env"]["CSRF_ALLOWED_ORIGINS"] || "")["split"](","),
  ];
  for (const entry of configured) {
    const parsed = hostOf(entry);
    if (parsed) hosts["add"](parsed);
  }
  return hosts;
}

function hostOf(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value["trim"]();
  if (!trimmed) return null;
  try {
    return new URL(trimmed)["host"]["toLowerCase"]();
  } catch {
    // Bare host such as "example.com" or "example.com:3000".
    return /^[a-z0-9.:-]+$/i["test"](trimmed) ? trimmed["toLowerCase"]() : null;
  }
}

/** Length-independent comparison so token checks do not leak via timing. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a["length"] !== b["length"]) return false;
  let diff = 0;
  for (let i = 0; i < a["length"]; i++) {
    diff |= a["charCodeAt"](i) ^ b["charCodeAt"](i);
  }
  return diff === 0;
}
