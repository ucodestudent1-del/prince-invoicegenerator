import { cookies, headers } from "next/headers";

const locales = ["en", "fr", "es", "de"];
const defaultLocale = "en";

async function getLocale() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  
  let locale = cookieStore.get("locale")?.value;
  
  if (!locale || !locales.includes(locale as any)) {
    const acceptLanguage = headerStore.get("accept-language");
    if (acceptLanguage) {
      const preferred = acceptLanguage.split(",")[0]?.split("-")[0];
      if (locales.includes(preferred as any)) {
        locale = preferred as string;
      }
    }
  }
  
  if (!locale || !locales.includes(locale as any)) {
    locale = defaultLocale;
  }

  return locale;
}

export async function getRequestConfig() {
  const locale = await getLocale();
  const messages = (await import(`./messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
}

export { locales, defaultLocale };
