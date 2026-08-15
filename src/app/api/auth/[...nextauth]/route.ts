import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

// Ensure host header is trusted in production behind a proxy (Railway, Vercel, etc.)
// In NextAuth v4, NEXTAUTH_URL controls proxy trust. AUTH_TRUST_HOST is used as
// a secondary signal to suppress the warning and optionally set the URL dynamically.
const trustProxy = process.env.AUTH_TRUST_HOST === "true";

// Fallback: derive NEXTAUTH_URL from the request host if not explicitly set.
function ensureAuthUrl(request: NextRequest) {
  if (!process.env.NEXTAUTH_URL && trustProxy && request.headers.get("host")) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    process.env.NEXTAUTH_URL = `${proto}://${request.headers.get("host")}`;
  }
}

let handler: ReturnType<typeof NextAuth> | null = null;

function getHandler() {
  if (!handler) {
    handler = NextAuth(authOptions);
  }
  return handler;
}

function preflightCheck(request: NextRequest): NextResponse | null {
  ensureAuthUrl(request);

  if (process.env.NODE_ENV === "production") {
    if (!process.env.NEXTAUTH_SECRET) {
      console.error(
        "[auth] NEXTAUTH_SECRET is not set — NextAuth cannot initialize in production."
      );
      return NextResponse.json(
        {
          error:
            "Server is misconfigured: NEXTAUTH_SECRET is required in production. " +
            "Generate one with: openssl rand -base64 32",
        },
        { status: 500 }
      );
    }
    if (!process.env.NEXTAUTH_URL) {
      console.error(
        "[auth] NEXTAUTH_URL is not set — callback URLs will be incorrect."
      );
      return NextResponse.json(
        {
          error:
            "Server is misconfigured: NEXTAUTH_URL is required in production. " +
            "Set it to the fully qualified public origin (e.g. https://your-app.up.railway.app).",
        },
        { status: 500 }
      );
    }
    if (!trustProxy) {
      console.warn(
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
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const params = await context.params;
    const authHandler = getHandler();
    return authHandler(request, { params });
  } catch (err) {
    console.error("Auth GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const params = await context.params;
    const authHandler = getHandler();
    return authHandler(request, { params });
  } catch (err) {
    console.error("Auth POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const HEAD = GET;
