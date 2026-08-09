import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales, defaultLocale } from "@/i18n";

const PUBLIC_FILE = /\.(?!css|tsx?|jsx?|json|txt|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot|map)$/;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const cookieLocale = req.cookies.get("locale")?.value;
  let locale = locales.includes(cookieLocale as any) ? cookieLocale : null;

  if (!locale) {
    const acceptLanguage = req.headers.get("accept-language");
    if (acceptLanguage) {
      const preferred = acceptLanguage.split(",")[0]?.split("-")[0];
      if (locales.includes(preferred as any)) {
        locale = preferred;
      }
    }
  }

  if (!locale) {
    locale = defaultLocale;
  }

  if (locale !== defaultLocale && !pathname.startsWith(`/${locale}`)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    const response = NextResponse.redirect(url);
    response.cookies.set("locale", locale, {
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
    });
    return response;
  }

  if (locale === defaultLocale && pathname !== "/" && !pathname.startsWith(`/${defaultLocale}`)) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
