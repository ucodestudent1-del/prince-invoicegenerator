import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function getLocale() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  let locale = cookieStore.get("locale")?.value;

  if (!locale || !routing.locales.includes(locale as any)) {
    const acceptLanguage = headerStore.get("accept-language");
    if (acceptLanguage) {
      const preferred = acceptLanguage.split(",")[0]?.split("-")[0];
      if (routing.locales.includes(preferred as any)) {
        locale = preferred as string;
      }
    }
  }

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return locale;
}

async function getOrgDefaultLocale(orgId: string | null): Promise<string | null> {
  if (!orgId) return null;
  try {
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { defaultLocale: true },
    });
    return org?.defaultLocale ?? null;
  } catch {
    return null;
  }
}

export default getRequestConfig(async () => {
  const cookieLocale = await getLocale();
  let locale = cookieLocale;

  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const dbUser = await db.user.findUnique({
        where: { id: session.user.id },
        select: { locale: true, organizationId: true },
      });
      const userLocale = dbUser?.locale;
      const orgDefault = await getOrgDefaultLocale(dbUser?.organizationId ?? null);
      if (userLocale && routing.locales.includes(userLocale as any)) {
        locale = userLocale;
      } else if (orgDefault && routing.locales.includes(orgDefault as any)) {
        locale = orgDefault;
      }
    }
  } catch {
    // Fall back to cookie/Accept-Language locale
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
