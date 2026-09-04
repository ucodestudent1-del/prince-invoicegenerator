import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { LocaleRedirectGuard } from "@/components/locale-redirect-guard";
import { setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import "./globals.css";
import "@/styles/invoice-print.css";
import "@/styles/estimate.css";
import "@/styles/change-order.css";
import { ThemeClient } from "@/components/theme-client";
import { CookieConsent } from "@/components/cookie-consent";
import { Analytics } from "@/components/analytics";
import { JsonLd } from "@/components/json-ld";

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
	metadataBase: new URL("https://princeinvoicegenerator.up.railway.app"),
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
	manifest: "/manifest.webmanifest",
	icons: {
		icon: [{ url: "/icon", type: "image/png" }],
		apple: [{ url: "/apple-icon", type: "image/png" }],
	},
};

async function getInitialTheme(): Promise<"light" | "dark"> {
	// Marketing layout: only the cookie. The dashboard layout overrides this
	// with the org's persisted preference once a session is established.
	try {
		const cookieTheme = cookies()["get"]("theme")?.["value"];
		return cookieTheme === "dark" ? "dark" : "light";
	} catch {
		return "light";
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
	const theme = await getInitialTheme();

	return (
		<html lang={params["locale"]}>
		<head>
			<JsonLd />
		</head>
		<body className={`min-h-screen antialiased ${inter["variable"]} ${playfair["variable"]}`}>
		<NextIntlClientProvider locale={params["locale"]} messages={messages}>
			<LocaleRedirectGuard />
			<ThemeClient initialTheme={theme} brandColor={null} />
			<CookieConsent />
			<Analytics />
			{children}
		</NextIntlClientProvider>
      </body>
    </html>
  );
}

