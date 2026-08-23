"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocaleSafe } from "@/hooks/use-locale-safe";
import { usePathname } from "next/navigation";
import { routing } from "@/i18n/routing";

const LOCALES = routing["locales"] as readonly string[];

/**
 * Check if a pathname already has a locale prefix.
 * e.g. "/en/login" → true, "/login" → false
 */
function hasLocalePrefix(pathname: string): boolean {
  return LOCALES["some"](
    (locale) => pathname === `/${locale}` || pathname["startsWith"](`/${locale}/`)
  );
}

export function LocaleRedirectGuard() {
  const router = useRouter();
  // Use Next.js's usePathname (not next-intl's) to get the full pathname
  // including the locale prefix from the URL.
  const fullPathname = usePathname();
  const locale = useLocaleSafe();

  useEffect(() => {
    if (!fullPathname) return;

    // If the URL doesn't have a locale prefix, redirect to the localized version.
    // We pass the un-prefixed pathname to router.replace — the next-intl router
    // adds the locale prefix exactly once internally.
    //
    // If the URL already has a locale prefix, do nothing — the middleware
    // already handles the initial locale redirect on the server side.
    if (!hasLocalePrefix(fullPathname)) {
      router["replace"](fullPathname, { locale });
    }
  }, [fullPathname, locale, router]);

  return null;
}
