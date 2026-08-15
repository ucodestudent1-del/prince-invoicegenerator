import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr", "es", "de"],
  defaultLocale: "en",
  // Use the same cookie name that src/i18n/request.ts reads ("locale").
  // This ensures that when the LanguageSwitcher updates the locale via
  // next-intl's useRouter, the server-side locale detection in request.ts
  // picks up the updated value.
  localeCookie: {
    name: "locale",
  },
});
