import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

let handler: ReturnType<typeof NextAuth> | null = null;

function getHandler() {
  if (!handler) {
    handler = NextAuth(authOptions);
  }
  return handler;
}

function preflightCheck(): NextResponse | null {
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
            "Set it to the fully qualified public origin.",
        },
        { status: 500 }
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
  const preflight = preflightCheck();
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
  const preflight = preflightCheck();
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
