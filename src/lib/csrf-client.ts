"use client";

/**
 * Client helper for the double-submit CSRF cookie (Plan 1.3).
 *
 * Origin validation in the middleware already protects every mutation, so this
 * is optional defence in depth. Spread `csrfHeaders()` into any `fetch` that
 * mutates state:
 *
 *   await fetch("/api/addresses", {
 *     method: "POST",
 *     headers: { "content-type": "application/json", ...csrfHeaders() },
 *     body: JSON.stringify(payload),
 *   });
 */

import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf";

/** Read the CSRF token the middleware placed in a readable cookie. */
export function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document["cookie"]
    ["split"](";")
    ["map"]((part) => part["trim"]())
    ["find"]((part) => part["startsWith"](`${CSRF_COOKIE}=`));
  if (!match) return null;
  const value = match["slice"](CSRF_COOKIE["length"] + 1);
  return value ? decodeURIComponent(value) : null;
}

/**
 * Headers to merge into a mutating `fetch`. Returns an empty object when no
 * token is available, which leaves origin validation as the active defence.
 */
export function csrfHeaders(): Record<string, string> {
  const token = readCsrfToken();
  return token ? { [CSRF_HEADER]: token } : {};
}
