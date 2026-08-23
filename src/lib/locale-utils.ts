import { routing } from "@/i18n/routing";

export const DEFAULT_LOCALE = routing["defaultLocale"] ?? "en";
export const LOCALES = routing["locales"] as readonly string[];

export function isMissingLocalePath(pathname: string, locale: string): boolean {
  return !pathname["startsWith"](`/${locale}`) && !pathname["startsWith"](`/${locale}/`);
}

/**
 * Strip ALL existing locale prefixes from a pathname.
 * Handles double-prefix cases like /en/en/login → /login.
 */
export function stripLocalePrefix(pathname: string): string {
  let result = pathname;
  // Keep stripping until no locale prefix remains (handles /en/en/login)
  let changed = true;
  while (changed) {
    changed = false;
    for (const locale of LOCALES) {
      if (result === `/${locale}`) {
        result = "/";
        changed = true;
        break;
      }
      if (result["startsWith"](`/${locale}/`)) {
        result = result["slice"](`/${locale}`["length"]);
        changed = true;
        break;
      }
    }
  }
  return result;
}

/**
 * Ensure a pathname has exactly one locale prefix.
 * Strips any existing locale(s) first, then adds the given locale.
 * e.g. ensureLocalePrefix("/en/en/login", "en") → "/en/login"
 *      ensureLocalePrefix("/login", "en")          → "/en/login"
 *      ensureLocalePrefix("/", "en")                 → "/en"
 */
export function ensureLocalePrefix(pathname: string, locale: string = DEFAULT_LOCALE): string {
  const stripped = stripLocalePrefix(pathname);
  if (stripped === "/") return `/${locale}`;
  return `/${locale}${stripped}`;
}