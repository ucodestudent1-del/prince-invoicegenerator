import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

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

export default getRequestConfig(async () => {
  const locale = await getLocale();
  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
