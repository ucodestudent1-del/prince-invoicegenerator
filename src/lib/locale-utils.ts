import { routing } from "@/i18n/routing";

export const DEFAULT_LOCALE = routing.defaultLocale ?? "en";

export function isMissingLocalePath(pathname: string, locale: string): boolean {
  return !pathname.startsWith(`/${locale}`) && !pathname.startsWith(`/${locale}/`);
}