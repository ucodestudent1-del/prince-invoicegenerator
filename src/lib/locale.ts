import { getLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

export const DEFAULT_LOCALE = routing["defaultLocale"] ?? "en";

export async function getLocaleSafe(): Promise<string> {
  try {
    return await getLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}
