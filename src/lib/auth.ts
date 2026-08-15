import type { NextAuthOptions, DefaultSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { APP_NAME } from "@/lib/app-name";
import { isMissingColumnError } from "@/lib/org";
import { logServerError } from "@/lib/errors";

export { APP_NAME };

const providers: NextAuthOptions["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

// Development-only email login so the app is usable without OAuth secrets.
if (process.env.NODE_ENV !== "production") {
  providers.push(
    CredentialsProvider({
      name: "Email (dev)",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        return {
          id: credentials.email,
          email: credentials.email,
          name: credentials.name || credentials.email.split("@")[0],
        };
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers,
  session: { strategy: "database" },
  theme: {
    brandColor: "#ea5804",
    colorScheme: "auto",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        let organizationId: string | null = null;
        let role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" = "OWNER";
        let userLocale: string | null = null;
        try {
          const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: { organizationId: true, role: true, locale: true },
          });
          organizationId = dbUser?.organizationId ?? null;
          role = dbUser?.role ?? "OWNER";
          userLocale = dbUser?.locale ?? null;
        } catch (err) {
          if (isMissingColumnError(err)) {
            try {
              const dbUser = await db.user.findUnique({
                where: { id: user.id },
                select: { organizationId: true, role: true, locale: true },
              });
              organizationId = dbUser?.organizationId ?? null;
              role = dbUser?.role ?? "OWNER";
              userLocale = dbUser?.locale ?? null;
            } catch {
              // Fall through to defaults
            }
          }
          logServerError("auth session callback", err);
        }
        session.user.organizationId = organizationId;
        session.user.role = role;
        session.user.locale = userLocale;
      }
      return { ...session, appName: APP_NAME };
    },
    async redirect({ url, baseUrl }) {
      const locales = ["en", "fr", "es", "de"] as const;

      // Relative URLs (e.g. callbackUrl="/en/dashboard") are returned as-is.
      if (!url.startsWith("http")) {
        return url;
      }

      const target = new URL(url);

      // If NEXTAUTH_URL is missing or empty, fall back to the target origin.
      // This prevents a 404 when the user ends up on localhost.
      const effectiveBaseUrl = baseUrl || target.origin;

      const origin = new URL(effectiveBaseUrl);

      // If the target is on a different origin than baseUrl, return baseUrl
      // to prevent open redirects. But if baseUrl is localhost and the target
      // is the real production domain, prefer the target (proxy-aware).
      if (target.origin === "http://localhost:3000" && origin.origin !== "http://localhost:3000") {
        // baseUrl is likely misconfigured (localhost); use the target's origin instead
        const pathname = target.pathname;
        const hasLocale = locales.some(
          (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
        );
        if (hasLocale) {
          return target.origin + target.pathname + target.search + target.hash;
        }
        return `${target.origin}${origin.pathname || "/en"}${target.search}${target.hash}`;
      }

      if (target.origin !== origin.origin) {
        return effectiveBaseUrl;
      }

      const pathname = target.pathname;
      const hasLocale = locales.some(
        (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
      );

      if (hasLocale) {
        return url;
      }

      return `${origin.origin}${origin.pathname || "/en"}${pathname}${target.search}${target.hash}`;
    },
  },
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organizationId: string | null;
      role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
      locale: string | null;
    } & DefaultSession["user"];
  }

  interface JWT {
    appName?: string;
  }
}
