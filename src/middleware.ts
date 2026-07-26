import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Lightweight gate: redirect unauthenticated users away from dashboard routes.
// Full enforcement also happens in server components via requireUser().
export function middleware(req: NextRequest) {
  const hasSession =
    req.cookies.has("next-auth.session-token") ||
    req.cookies.has("__Secure-next-auth.session-token");
  if (!hasSession) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
