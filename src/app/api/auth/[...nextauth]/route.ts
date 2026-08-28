import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

// Ensure host header is trusted in production behind a proxy (Railway, Vercel, etc.)
// In NextAuth v4, NEXTAUTH_URL controls proxy trust. AUTH_TRUST_HOST is used as
// a secondary signal to suppress the warning.
const trustProxy = process["env"]["AUTH_TRUST_HOST"] === "true";

// Derive NEXTAUTH_URL from the request host if not explicitly set.
// This must be done BEFORE the NextAuth handler is initialized, because
// NextAuth reads NEXTAUTH_URL at init time. In serverless environments,
// process.env is read-only after cold start, so we log a warning instead of
// mutating it at runtime (which doesn't work reliably in Edge/Node serverless).
function getAuthUrl(request: NextRequest): string | undefined {
  const existing = process["env"]["NEXTAUTH_URL"];
  if (existing) return existing;

  const host = request["headers"]["get"]("host");
  if (host) {
    const proto = request["headers"]["get"]("x-forwarded-proto") || "https";
    const derived = `${proto}://${host}`;
    if (process["env"]["NODE_ENV"] === "production") {
      console["warn"](`[auth] NEXTAUTH_URL was not set; derived from request: ${derived}`);
    }
    return derived;
  }
  return undefined;
}

let handler: ReturnType<typeof NextAuth> | null = null;
let handlerInitUrl: string | undefined;

function getHandler(request: NextRequest): ReturnType<typeof NextAuth> {
  const currentUrl = getAuthUrl(request);
  // Re-initialize if the derived URL changed (cross-request correctness in serverless)
  if (!handler || handlerInitUrl !== currentUrl) {
    if (currentUrl && !process["env"]["NEXTAUTH_URL"]) {
      process["env"]["NEXTAUTH_URL"] = currentUrl;
    }
    handler = NextAuth(authOptions);
    handlerInitUrl = currentUrl;
  }
  return handler;
}

function preflightCheck(request: NextRequest): NextResponse | null {
  const authUrl = getAuthUrl(request);

  if (process["env"]["NODE_ENV"] === "production") {
    if (!process["env"]["NEXTAUTH_SECRET"]) {
      console["error"](
        "[auth] NEXTAUTH_SECRET is not set — NextAuth cannot initialize in production."
      );
      return NextResponse["json"](
        {
          error:
            "Server is misconfigured: NEXTAUTH_SECRET is required in production. " +
            "Generate one with: openssl rand -base64 32",
        },
        { status: 500 }
      );
    }
    if (!authUrl) {
      console["error"](
        "[auth] NEXTAUTH_URL is not set — callback URLs will be incorrect."
      );
      return NextResponse["json"](
        {
          error:
            "Server is misconfigured: NEXTAUTH_URL is required in production. " +
            "Set it to the fully qualified public origin (e.g. https://your-app.up.railway.app).",
        },
        { status: 500 }
      );
    }
    if (!trustProxy) {
      console["warn"](
        "[auth] AUTH_TRUST_HOST is not set to 'true' in production. " +
        "Behind a proxy, this may cause incorrect callback URLs and session cookie domain issues."
      );
    }
  }
  return null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const preflight = preflightCheck(request);
  if (preflight) return preflight;

  try {
    const limit = rateLimit(request);
    if (!limit["ok"]) {
      return NextResponse["json"]({ error: "Too many requests" }, { status: 429 });
    }
    const params = await context["params"];
    const authHandler = getHandler(request);
    return authHandler(request, { params });
  } catch (err) {
    console["error"]("Auth GET error:", err);
    return NextResponse["json"]({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const preflight = preflightCheck(request);
  if (preflight) return preflight;

  try {
    const limit = rateLimit(request);
    if (!limit["ok"]) {
      return NextResponse["json"]({ error: "Too many requests" }, { status: 429 });
    }
    const params = await context["params"];
    const authHandler = getHandler(request);
    return authHandler(request, { params });
  } catch (err) {
    console["error"]("Auth POST error:", err);
    return NextResponse["json"]({ error: "Internal server error" }, { status: 500 });
  }
};

export const HEAD = GET;
