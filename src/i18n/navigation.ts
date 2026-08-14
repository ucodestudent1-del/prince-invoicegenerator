import { createNavigation } from "next-intl/navigation";
import { useLocaleSafe } from "@/hooks/use-locale-safe";
import { useMemo } from "react";
import { routing } from "./routing";

const {
  Link,
  redirect,
  usePathname,
  useRouter: _useRouter,
  getPathname,
} = createNavigation(routing);

export function useRouter() {
  const router = _useRouter();
  const safeLocale = useLocaleSafe();
  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Record<string, unknown>) =>
        router.push(href, { locale: safeLocale, ...(options as object) }),
      replace: (href: string, options?: Record<string, unknown>) =>
        router.replace(href, { locale: safeLocale, ...(options as object) }),
    }),
    [router, safeLocale]
  );
}

// Wrapper that ensures forcePrefix is true when locale is provided
export function getPathnameWithLocale(args: { href: string; locale: string }) {
  return getPathname({ href: args.href, locale: args.locale, forcePrefix: true });
}

export { Link, redirect, usePathname, getPathname };