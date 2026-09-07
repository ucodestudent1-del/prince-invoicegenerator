import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Recursively fill any key present in the source locale (en) but missing from
 * the active locale's message bundle.
 *
 * Why this exists: `useTranslations()` returns the *literal key string* when a
 * key is absent. Without this guard a developer who adds a feature (and a new
 * `t("namespace.newKey")` call) but forgets to merge the key into de/es/fr
 * ships a UI that renders `"namespace.newKey"` to end users with no error.
 *
 * This runs once per request, is cheap (only walks the source locale once),
 * and is a belt-and-suspenders net: the CI gate in `scripts/i18n-verify.cjs`
 * still fails the build if a target locale drifts. This only prevents the
 * silent runtime regression from reaching a real user.
 */
function fillMissing(source: Record<string, any>, target: Record<string, any>): void {
  for (const [key, sourceValue] of Object.entries(source)) {
    if (!(key in target)) {
      target[key] = sourceValue;
      continue;
    }
    const sv = sourceValue;
    const tv = target[key];
    if (
      sv &&
      typeof sv === "object" &&
      !Array.isArray(sv) &&
      tv &&
      typeof tv === "object" &&
      !Array.isArray(tv)
    ) {
      fillMissing(sv as Record<string, any>, tv as Record<string, any>);
    }
  }
}

async function getCookieLocale(): Promise<string | null> {
  const cookieStore = await cookies();
  const locale = cookieStore["get"]("locale")?.["value"];
  if (locale && routing["locales"]["includes"](locale as any)) {
    return locale as string;
  }
  return null;
}

async function getAcceptLanguageLocale(): Promise<string | null> {
  const headerStore = await headers();
  const acceptLanguage = headerStore["get"]("accept-language");
  if (acceptLanguage) {
    const preferred = acceptLanguage["split"](",")[0]?.["split"]("-")[0];
    if (preferred && routing["locales"]["includes"](preferred as any)) {
      return preferred as string;
    }
  }
  return null;
}

async function getDbUserLocale(userId: string): Promise<string | null> {
  try {
    const dbUser = await db["user"]["findUnique"]({
      where: { id: userId },
      select: { locale: true, organizationId: true },
    });
    const userLocale = dbUser?.["locale"];
    if (userLocale && routing["locales"]["includes"](userLocale as any)) {
      return userLocale as string;
    }
    if (dbUser?.["organizationId"]) {
      try {
        const org = await db["organization"]["findUnique"]({
          where: { id: dbUser["organizationId"] },
          select: { defaultLocale: true },
        });
        const orgDefault = org?.["defaultLocale"];
        if (orgDefault && routing["locales"]["includes"](orgDefault as any)) {
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
    if (session?.["user"]?.["id"]) {
      locale = await getDbUserLocale(session["user"]["id"]);
    }
  }

  if (!locale) {
    locale = await getAcceptLanguageLocale();
  }

  if (!locale || !routing["locales"]["includes"](locale as any)) {
    locale = routing["defaultLocale"];
  }

  const messages = (await import(`../messages/${locale}.json`))["default"];

  // Safety net: backfill any key the active locale is missing from the source
  // locale so a missing translation renders English instead of the raw key.
  if (locale !== routing["defaultLocale"]) {
    try {
      const sourceMessages = (await import(`../messages/${routing["defaultLocale"]}.json`))["default"];
      fillMissing(sourceMessages, messages);
    } catch {
      // Non-fatal: if the source locale cannot be loaded, fall back to whatever
      // the active locale already contains.
    }
  }

  return {
    locale,
    messages,
  };
});
