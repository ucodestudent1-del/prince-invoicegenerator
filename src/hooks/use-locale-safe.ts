import { useLocale } from "next-intl";
import { routing } from "@/i18n/routing";

// Hook that always returns a valid locale string.
// Falls back to routing.defaultLocale if useLocale() returns undefined/empty,
// which can happen if NextIntlClientProvider auto-detection fails in edge cases.
export function useLocaleSafe(): string {
  const locale = useLocale();
  return locale || routing.defaultLocale;
}