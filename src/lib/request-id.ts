/**
 * Request correlation IDs (Plan 2.1).
 *
 * A `x-request-id` is generated at the middleware edge and forwarded on the
 * request headers. Server components, route handlers and server actions read it
 * back with `getRequestId()` so every log line and audit row can be correlated
 * to a single inbound request.
 *
 * This module is edge-safe: it only touches Web Crypto and `next/headers`, and
 * every `next/headers` access is guarded because it throws outside of a request
 * scope (background jobs, scripts, unit tests).
 */

export const REQUEST_ID_HEADER = "x-request-id";
export const NONCE_HEADER = "x-nonce";

/** Generate a short, URL-safe correlation ID. */
export function generateRequestId(): string {
  try {
    const uuid = globalThis["crypto"]?.["randomUUID"]?.();
    if (uuid) return uuid["replace"](/-/g, "")["slice"](0, 24);
  } catch {
    // fall through to the Math.random path below
  }
  return `${Date["now"]()["toString"](36)}${Math["random"]()["toString"](36)["slice"](2, 10)}`;
}

/**
 * Read the current request's correlation ID, or `undefined` when called outside
 * a request scope. Never throws.
 */
export function getRequestId(): string | undefined {
  const bag = readHeaders();
  if (!bag) return undefined;
  try {
    return bag["get"](REQUEST_ID_HEADER) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Read the CSP nonce issued by the middleware for the current document request.
 * Returns `undefined` when strict CSP is disabled or outside a request scope.
 */
export function getCspNonce(): string | undefined {
  const bag = readHeaders();
  if (!bag) return undefined;
  try {
    return bag["get"](NONCE_HEADER) ?? undefined;
  } catch {
    return undefined;
  }
}

type HeaderBag = { get(name: string): string | null };

/**
 * `next/headers` is only importable inside the Next server runtime, and
 * `headers()` itself throws when there is no active request. Both failure modes
 * are swallowed so logging never becomes a source of errors.
 */
function readHeaders(): HeaderBag | null {
  try {
    // Lazily resolved so this module stays importable from plain Node scripts.
    const mod = require("next/headers") as { headers: () => HeaderBag };
    return mod["headers"]();
  } catch {
    return null;
  }
}
