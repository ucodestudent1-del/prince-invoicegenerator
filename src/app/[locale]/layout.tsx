import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { LocaleRedirectGuard } from "@/components/locale-redirect-guard";
import { setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import "./globals.css";
import "@/styles/invoice-print.css";
import { ThemeClient } from "@/components/theme-client";
import { CookieConsent } from "@/components/cookie-consent";
import { Analytics } from "@/components/analytics";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMissingColumnError, ensureEnv } from "@/lib/org";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// This layout reads cookies(), the session, and the database via
// getInitialTheme(), so it must render dynamically per request. Without this,
// Next attempts to statically generate/cache child routes (home, login, signup,
// pricing, etc.) and the cookies()/session access during the cached render
// throws "You reached the start of the range" (see doRender -> responseCache).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Prince — Construction Invoice Generator",
    template: "%s — Prince",
  },
  description:
    "Professional invoicing, estimates, change orders, and retainage tracking for construction contractors.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://princeinvoicegenerator.up.railway.app",
    title: "Prince — Construction Invoice Generator",
    description:
      "Professional invoicing, estimates, change orders, and retainage tracking for construction contractors.",
    siteName: "Prince Invoice Generator",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prince — Construction Invoice Generator",
    description:
      "Professional invoicing, estimates, change orders, and retainage tracking for construction contractors.",
  },
  alternates: {
    canonical: "https://princeinvoicegenerator.up.railway.app",
  },
  other: {
    "application/ld+json": JSON["stringify"]({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Prince Invoice Generator",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Professional invoicing, estimates, change orders, and retainage tracking for construction contractors.",
      url: "https://princeinvoicegenerator.up.railway.app",
      provider: {
        "@type": "Organization",
        name: "Prince Invoice Generator",
      },
    }),
  },
};

async function getInitialTheme() {
  try {
    const cookieTheme = cookies()["get"]("theme")?.["value"];
    const session = await getServerSession(authOptions);
    if (!session?.["user"]?.["id"]) {
      return {
        theme: cookieTheme === "dark" || cookieTheme === "light" ? cookieTheme : "light",
        brandColor: null,
        fontFamily: null,
      };
    }

    try {
      const user = await db["user"]["findUnique"]({
        where: { id: session["user"]["id"] },
        select: {
          organization: {
            select: { theme: true, brandColor: true, fontFamily: true },
          },
        },
      });
      return {
        theme: user?.["organization"]?.["theme"] ?? cookieTheme ?? "light",
        brandColor: user?.["organization"]?.["brandColor"] ?? null,
        fontFamily: user?.["organization"]?.["fontFamily"] ?? null,
      };
    } catch (dbErr) {
      if (isMissingColumnError(dbErr) && cookieTheme) {
        return {
          theme: cookieTheme === "dark" ? "dark" : "light",
          brandColor: null,
          fontFamily: null,
        };
      }
      console["error"]("getInitialTheme DB error:", dbErr);
      return { theme: "light", brandColor: null, fontFamily: null };
    }
  } catch {
    return { theme: "light", brandColor: null, fontFamily: null };
  }
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();
  ensureEnv();
  const { theme, brandColor } = await getInitialTheme();

  return (
    <html lang={params["locale"]}>
      <body className={`min-h-screen antialiased ${inter["variable"]} ${playfair["variable"]}`}>
        <NextIntlClientProvider locale={params["locale"]} messages={messages}>
          <LocaleRedirectGuard />
          <ThemeClient
            initialTheme={theme}
            brandColor={brandColor}
          />
          <CookieConsent />
          <Analytics />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

