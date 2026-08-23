let geoip: typeof import("geoip-lite") | null = null;

export function getGeoIp() {
  if (!geoip) {
    try {
      geoip = require("geoip-lite");
    } catch {
      return null;
    }
  }
  return geoip;
}

export interface GeoSettings {
  country: string;
  currency: string;
  timezone: string;
  language: string;
  dateFormat: string;
  numberFormat: string;
}

const COUNTRY_DEFAULTS: Record<string, Omit<GeoSettings, "country" | "language">> = {
  US: { currency: "USD", timezone: "America/New_York", dateFormat: "MM/DD/YYYY", numberFormat: "en-US" },
  CA: { currency: "CAD", timezone: "America/Toronto", dateFormat: "MM/DD/YYYY", numberFormat: "en-CA" },
  GB: { currency: "GBP", timezone: "Europe/London", dateFormat: "DD/MM/YYYY", numberFormat: "en-GB" },
  AU: { currency: "AUD", timezone: "Australia/Sydney", dateFormat: "DD/MM/YYYY", numberFormat: "en-AU" },
  DE: { currency: "EUR", timezone: "Europe/Berlin", dateFormat: "DD.MM.YYYY", numberFormat: "de-DE" },
  FR: { currency: "EUR", timezone: "Europe/Paris", dateFormat: "DD/MM/YYYY", numberFormat: "fr-FR" },
  ES: { currency: "EUR", timezone: "Europe/Madrid", dateFormat: "DD/MM/YYYY", numberFormat: "es-ES" },
  MX: { currency: "MXN", timezone: "America/Mexico_City", dateFormat: "DD/MM/YYYY", numberFormat: "es-MX" },
  IN: { currency: "INR", timezone: "Asia/Kolkata", dateFormat: "DD/MM/YYYY", numberFormat: "en-IN" },
  BR: { currency: "BRL", timezone: "America/Sao_Paulo", dateFormat: "DD/MM/YYYY", numberFormat: "pt-BR" },
};

const FALLBACK: GeoSettings = {
  country: "US",
  currency: "USD",
  timezone: "America/New_York",
  language: "en",
  dateFormat: "MM/DD/YYYY",
  numberFormat: "en-US",
};

export function getAutoDetectedSettings(ipAddress?: string | null, browserLocale?: string | null): GeoSettings {
  let country = FALLBACK["country"];

  if (ipAddress) {
    const geoipModule = getGeoIp();
    if (geoipModule) {
      const geo = geoipModule["lookup"](ipAddress);
      if (geo?.["country"]) {
        country = geo["country"];
      }
    }
  }

  const defaults = COUNTRY_DEFAULTS[country] || {};

  return {
    country,
    currency: defaults["currency"] || FALLBACK["currency"],
    timezone: defaults["timezone"] || FALLBACK["timezone"],
    language: browserLocale?.["split"](",")[0]?.["split"]("-")[0] || FALLBACK["language"],
    dateFormat: defaults["dateFormat"] || FALLBACK["dateFormat"],
    numberFormat: defaults["numberFormat"] || FALLBACK["numberFormat"],
  };
}
