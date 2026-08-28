import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";

export function middleware(request: NextRequest) {
  const { pathname } = request["nextUrl"];

  // Skip if path is a file, API route, or static asset
  if (
    pathname["startsWith"]("/api/") ||
    pathname["startsWith"]("/_next/") ||
    pathname["startsWith"]("/portal") ||
    pathname["startsWith"]("/api/auth/") ||
    pathname["includes"](".")
  ) {
    return NextResponse["next"]();
  }

  // Check if pathname already has a locale prefix
  const locales = routing["locales"];
  const hasLocale = locales["some"]((locale) => pathname === `/${locale}` || pathname["startsWith"](`/${locale}/`));

  // If no locale prefix, redirect to same path with default locale
  if (!hasLocale) {
    const url = request["nextUrl"]["clone"]();
    url["pathname"] = `/${routing["defaultLocale"]}${pathname}`;
    return NextResponse["redirect"](url, 307);
  }

  return NextResponse["next"]();
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};