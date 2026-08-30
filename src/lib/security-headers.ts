/**
 * Security response headers (Plan 1.5 / 2.9).
 *
 * The Content-Security-Policy is built per request in `src/middleware.ts` so it
 * can carry a fresh nonce. Static headers that never vary live in
 * `next.config.mjs`.
 *
 * Two policies are available:
 * - `strict`  (default) — nonce + `'strict-dynamic'`, no `'unsafe-inline'` and
 *   no `'unsafe-eval'` in `script-src`. Next.js automatically stamps the nonce
 *   onto its own bootstrap and chunk tags.
 * - `compat`  — the previous permissive policy. Escape hatch: set
 *   `FF_CSP=compat` if a third-party script ever needs inline execution.
 *
 * `'unsafe-eval'` is still added in development because the Next dev server and
 * React Fast Refresh rely on `eval`.
 *
 * Edge-safe — no Node built-ins are imported.
 */

export type CspMode = "strict" | "compat";

export function cspMode(): CspMode {
  const raw = (process["env"]["FF_CSP"] || "")["toLowerCase"]()["trim"]();
  return raw === "compat" || raw === "off" ? "compat" : "strict";
}

/** Generate a base64 nonce suitable for a CSP `script-src` entry. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  try {
    globalThis["crypto"]["getRandomValues"](bytes);
  } catch {
    for (let i = 0; i < bytes["length"]; i++) bytes[i] = Math["floor"](Math["random"]() * 256);
  }
  let binary = "";
  for (const byte of bytes) binary += String["fromCharCode"](byte);
  return btoa(binary);
}

/** Extra `connect-src` origins so browser-side error reporting is not blocked. */
function reportingOrigins(): string[] {
  const origins: string[] = [];
  for (const value of [process["env"]["SENTRY_DSN"], process["env"]["ERROR_WEBHOOK_URL"]]) {
    if (!value) continue;
    try {
      origins["push"](new URL(value)["origin"]);
    } catch {
      // Ignore malformed configuration rather than breaking the policy.
    }
  }
  return origins;
}

export function buildCsp(nonce: string): string {
  const isDev = process["env"]["NODE_ENV"] !== "production";
  const mode = cspMode();

  const scriptSrc =
    mode === "strict"
      ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])]
      : ["'self'", "'unsafe-inline'", "'unsafe-eval'"];

  const connectSrc = [
    "'self'",
    "https://*.stripe.com",
    "https://*.r2.cloudflarestorage.com",
    "https://*.r2.dev",
    ...reportingOrigins(),
    // The dev server uses a websocket for Fast Refresh.
    ...(isDev ? ["ws:", "wss:"] : []),
  ];

  const directives: string[] = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `script-src ${scriptSrc["join"](" ")}`,
    // Inline styles remain allowed: Next.js and Tailwind inject style tags and
    // React sets element style attributes, neither of which can carry a nonce.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `connect-src ${connectSrc["join"](" ")}`,
    `frame-src 'self' https://*.stripe.com https://accounts.google.com https://*.google.com`,
    `form-action 'self' https://accounts.google.com https://*.google.com`,
    `frame-ancestors 'none'`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
  ];

  if (!isDev) {
    directives["push"]("upgrade-insecure-requests");
  }

  return `${directives["join"]("; ")};`;
}

/**
 * Cross-origin isolation headers.
 *
 * COOP uses `same-origin-allow-popups` because Google OAuth opens a popup that
 * must keep its opener reference.
 *
 * COEP is opt-in via `FF_COEP` (`credentialless` or `require-corp`): enabling it
 * blocks Stripe and Google embeds unless those responses carry CORP headers, so
 * it must be validated against the payment and OAuth flows before rollout.
 */
export function crossOriginHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
  const coep = (process["env"]["FF_COEP"] || "")["toLowerCase"]()["trim"]();
  if (coep === "credentialless" || coep === "require-corp") {
    headers["Cross-Origin-Embedder-Policy"] = coep;
  }
  return headers;
}
