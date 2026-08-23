import { createNavigation } from "next-intl/navigation";
import { useLocaleSafe } from "@/hooks/use-locale-safe";
import { useMemo } from "react";
import { routing } from "./routing";
import { stripLocalePrefix } from "@/lib/locale-utils";

const {
  Link,
  redirect,
  usePathname,
  useRouter: _useRouter,
  getPathname,
} = createNavigation(routing);

/**
 * Strip any existing locale prefix from a string href before passing it to
 * next-intl's router. The custom useRouter always passes `locale: safeLocale`,
 * which causes next-intl to set `forcePrefix: true`. Without stripping,
 * a href like "/en/dashboard" would become "/en/en/dashboard".
 */
function normalizeHref(href: string): string {
  return stripLocalePrefix(href);
}

export function useRouter() {
  const router = _useRouter();
  const safeLocale = useLocaleSafe();
  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Record<string, unknown>) =>
        router["push"](normalizeHref(href), { locale: safeLocale, ...(options as object) }),
      replace: (href: string, options?: Record<string, unknown>) =>
        router["replace"](normalizeHref(href), { locale: safeLocale, ...(options as object) }),
    }),
    [router, safeLocale]
  );
}

// Wrapper that ensures forcePrefix is true when locale is provided
export function getPathnameWithLocale(args: { href: string; locale: string }) {
  return getPathname({ href: args["href"], locale: args["locale"], forcePrefix: true });
}

export { Link, redirect, usePathname, getPathname };
