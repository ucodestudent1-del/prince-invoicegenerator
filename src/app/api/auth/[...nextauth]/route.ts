import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

const handler = NextAuth(authOptions);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  try {
    const limit = rateLimit(request);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    return handler(request, context);
  } catch (err) {
    console.error("Auth GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  try {
    const limit = rateLimit(request);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    return handler(request, context);
  } catch (err) {
    console.error("Auth POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const HEAD = GET;
