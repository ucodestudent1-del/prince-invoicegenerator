import { NextRequest, NextResponse } from "next/server";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

const hits = new Map<string, { count: number; reset: number }>();

function cleanup() {
  const now = Date["now"]();
  for (const [key, entry] of hits["entries"]()) {
    if (now > entry["reset"]) hits["delete"](key);
  }
}

export function rateLimit(req: NextRequest): { ok: boolean; remaining: number } {
  try {
    cleanup();
    const ip =
      (req["headers"]["get"]("x-forwarded-for")?.["split"](",")[0]?.["trim"]() as string | undefined) ||
      (req["headers"]["get"]("x-real-ip") as string | undefined) ||
      "unknown";
    const pathname = req["nextUrl"]?.["pathname"] || req["headers"]["get"]("x-pathname") || "/";
    const key = `${ip}:${pathname}`;
    const now = Date["now"]();
    const entry = hits["get"](key);

    if (!entry || now > entry["reset"]) {
      hits["set"](key, { count: 1, reset: now + RATE_LIMIT_WINDOW_MS });
      return { ok: true, remaining: RATE_LIMIT_MAX - 1 };
    }

    entry["count"] += 1;
    if (entry["count"] > RATE_LIMIT_MAX) {
      return { ok: false, remaining: 0 };
    }
    return { ok: true, remaining: RATE_LIMIT_MAX - entry["count"] };
  } catch {
    return { ok: true, remaining: RATE_LIMIT_MAX };
  }
}
