import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { CSRF_COOKIE, CSRF_TOKEN_MAX_AGE_SECONDS, csrfMode, generateCsrfToken, verifyCsrf } from "@/lib/csrf";
import { NONCE_HEADER, REQUEST_ID_HEADER, generateRequestId } from "@/lib/request-id";
import { buildCsp, crossOriginHeaders, generateNonce } from "@/lib/security-headers";

/**
 * Edge middleware. Responsibilities, in order:
 *
 * 1. Assign a `x-request-id` correlation ID (Plan 2.1).
 * 2. Reject cross-site state-changing requests (CSRF, Plan 1.3).
 * 3. Attach a per-request CSP nonce and security headers (Plan 1.5 / 2.9).
 * 4. Redirect locale-less document paths to the default locale (pre-existing).
 *
 * This file must stay free of Node built-ins so it can run in the Edge runtime.
 */

export function middleware(request: NextRequest) {
  const { pathname } = request["nextUrl"];

  // Reuse an upstream correlation ID when the proxy already assigned one.
  const requestId = request["headers"]["get"](REQUEST_ID_HEADER) || generateRequestId();

  // ---- 1. CSRF ------------------------------------------------------------
  const mode = csrfMode();
  if (mode !== "off") {
    const result = verifyCsrf(request);
    if (!result["ok"]) {
      // Structured console output only: importing the logger would pull
      // Node-only modules into the Edge bundle.
      console["warn"](
        JSON["stringify"]({
          level: "warn",
          context: "csrf",
          message: "Rejected state-changing request",
          requestId,
          mode,
          method: request["method"],
          pathname,
          reason: result["reason"],
        })
      );
      if (mode === "enforce") {
        return NextResponse["json"](
          { error: "Invalid or missing CSRF validation for this request." },
          { status: 403, headers: { [REQUEST_ID_HEADER]: requestId } }
        );
      }
    }
  }

  const isApi = pathname["startsWith"]("/api/");
  const isInternal = pathname["startsWith"]("/_next/") || pathname["startsWith"]("/_vercel/");
  const isFile = pathname["includes"](".");

  // ---- 2. Non-document requests: correlation ID only -----------------------
  if (isApi || isInternal || isFile) {
    const response = NextResponse["next"]({
      request: { headers: withHeaders(request, { [REQUEST_ID_HEADER]: requestId }) },
    });
    response["headers"]["set"](REQUEST_ID_HEADER, requestId);
    return response;
  }

  // ---- 3. Document requests: nonce + CSP + locale -------------------------
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  // Next.js reads the nonce from the CSP on the *request* headers and stamps it
  // onto the script tags it renders, so both request and response carry it.
  const requestHeaders = withHeaders(request, {
    [REQUEST_ID_HEADER]: requestId,
    [NONCE_HEADER]: nonce,
    "Content-Security-Policy": csp,
  });

  const locales = routing["locales"];
  const hasLocale = locales["some"](
    (locale) => pathname === `/${locale}` || pathname["startsWith"](`/${locale}/`)
  );

  let response: NextResponse;
  if (!hasLocale && !pathname["startsWith"]("/portal")) {
    const url = request["nextUrl"]["clone"]();
    url["pathname"] = `/${routing["defaultLocale"]}${pathname}`;
    response = NextResponse["redirect"](url, 307);
  } else {
    response = NextResponse["next"]({ request: { headers: requestHeaders } });
  }

  response["headers"]["set"](REQUEST_ID_HEADER, requestId);
  response["headers"]["set"]("Content-Security-Policy", csp);
  for (const [key, value] of Object["entries"](crossOriginHeaders())) {
    response["headers"]["set"](key, value);
  }

  // ---- 4. Refresh the double-submit CSRF cookie ----------------------------
  // Readable by design (not httpOnly): clients echo it back in x-csrf-token.
  if (mode !== "off" && !request["cookies"]["get"](CSRF_COOKIE)) {
    response["cookies"]["set"](CSRF_COOKIE, generateCsrfToken(), {
      httpOnly: false,
      sameSite: "lax",
      secure: process["env"]["NODE_ENV"] === "production" || (process["env"]["NEXTAUTH_URL"] || "").startsWith("https:") || (process["env"]["NEXT_PUBLIC_BASE_URL"] || "").startsWith("https:"),
      path: "/",
      maxAge: CSRF_TOKEN_MAX_AGE_SECONDS,
    });
  }

  return response;
}

function withHeaders(request: NextRequest, extra: Record<string, string>): Headers {
  const headers = new Headers(request["headers"]);
  for (const [key, value] of Object["entries"](extra)) {
    headers["set"](key, value);
  }
  return headers;
}

export const config = {
  // Everything except immutable build output. API routes are included so CSRF
  // validation and correlation IDs cover state-changing endpoints.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
