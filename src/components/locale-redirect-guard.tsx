"use client";

import { useEffect } from "react";
import { useRouter, usePathname, getPathnameWithLocale } from "@/i18n/navigation";
import { useLocaleSafe } from "@/hooks/use-locale-safe";

export function LocaleRedirectGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocaleSafe();

  useEffect(() => {
    if (pathname === "/") {
      router.replace("/", { locale });
      return;
    }

    if (!pathname.startsWith(`/${locale}`) && !pathname.startsWith(`/${locale}/`)) {
      const target = getPathnameWithLocale({ href: pathname, locale });
      router.replace(target, { locale });
    }
  }, [pathname, locale, router]);

  return null;
}
