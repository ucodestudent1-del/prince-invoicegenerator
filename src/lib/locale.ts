import { getLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";

export const DEFAULT_LOCALE = routing["defaultLocale"] ?? "en";

export async function getLocaleSafe(): Promise<string> {
  try {
    return await getLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}

// Resolve an organization's default locale for locale-prefixed URLs (e.g. email links).
// Mirrors getDbUserLocale's schema-drift-safe lookup: falls back to DEFAULT_LOCALE
// when the column is missing or the value is not a supported locale.
export async function getOrgLocale(orgId: string): Promise<string> {
  try {
    const org = await db["organization"]["findUnique"]({
      where: { id: orgId },
      select: { defaultLocale: true },
    });
    const locale = org?.["defaultLocale"];
    if (locale && routing["locales"].includes(locale as any)) {
      return locale as string;
    }
  } catch {
    // defaultLocale column may not exist yet (schema drift)
  }
  return DEFAULT_LOCALE;
}
