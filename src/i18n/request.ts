import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function getCookieLocale(): Promise<string | null> {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value;
  if (locale && routing.locales.includes(locale as any)) {
    return locale as string;
  }
  return null;
}

async function getAcceptLanguageLocale(): Promise<string | null> {
  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  if (acceptLanguage) {
    const preferred = acceptLanguage.split(",")[0]?.split("-")[0];
    if (preferred && routing.locales.includes(preferred as any)) {
      return preferred as string;
    }
  }
  return null;
}

async function getDbUserLocale(userId: string): Promise<string | null> {
  try {
    const dbUser = await db.user.findUnique({
      where: { id: userId },
      select: { locale: true, organizationId: true },
    });
    const userLocale = dbUser?.locale;
    if (userLocale && routing.locales.includes(userLocale as any)) {
      return userLocale as string;
    }
    if (dbUser?.organizationId) {
      try {
        const org = await db.organization.findUnique({
          where: { id: dbUser.organizationId },
          select: { defaultLocale: true },
        });
        const orgDefault = org?.defaultLocale;
        if (orgDefault && routing.locales.includes(orgDefault as any)) {
          return orgDefault as string;
        }
      } catch {
        // Organization may not have defaultLocale column yet (schema drift)
      }
    }
    return null;
  } catch {
    return null;
  }
}

export default getRequestConfig(async () => {
  let locale = await getCookieLocale();

  if (!locale) {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      locale = await getDbUserLocale(session.user.id);
    }
  }

  if (!locale) {
    locale = await getAcceptLanguageLocale();
  }

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
