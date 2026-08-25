import type { NextAuthOptions, DefaultSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { APP_NAME } from "@/lib/app-name";
import { isMissingColumnError } from "@/lib/org";
import { logServerError } from "@/lib/errors";
import bcrypt from "bcryptjs";

export { APP_NAME };

// All supported locales
const LOCALES = ["en", "fr", "es", "de"] as const;

/**
 * Strip an existing locale prefix from a pathname to prevent double-prefixing.
 * e.g. "/en/login" → "/login", "/en/en/login" → "/login"
 * If the path doesn't start with a locale prefix, it's returned as-is.
 */
function stripLocalePrefix(pathname: string): string {
  for (const locale of LOCALES) {
    if (pathname === `/${locale}`) return "/";
    if (pathname["startsWith"](`/${locale}/`)) {
      return pathname["slice"](`/${locale}`["length"]);
    }
  }
  return pathname;
}

/**
 * Ensure a pathname has exactly one locale prefix.
 * Strips any existing locale(s) first, then adds the given locale.
 */
function ensureLocalePrefix(pathname: string, locale: string = "en"): string {
  const stripped = stripLocalePrefix(stripLocalePrefix(pathname));
  if (stripped === "/") return `/${locale}`;
  return `/${locale}${stripped}`;
}

const providers: NextAuthOptions["providers"] = [];

if (process["env"]["GOOGLE_CLIENT_ID"] && process["env"]["GOOGLE_CLIENT_SECRET"]) {
  providers["push"](
    GoogleProvider({
      clientId: process["env"]["GOOGLE_CLIENT_ID"],
      clientSecret: process["env"]["GOOGLE_CLIENT_SECRET"],
    })
  );
}

providers["push"](
  CredentialsProvider({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.["email"] || !credentials?.["password"]) {
        return null;
      }

      const normalizedEmail = credentials["email"]["toLowerCase"]();

      const user = await db["user"]["findUnique"]({
        where: { email: normalizedEmail },
      });

      if (!user || !user["password"]) {
        return null;
      }

      const isValid = await bcrypt["compare"](credentials["password"], user["password"]);
      if (!isValid) {
        return null;
      }

      return {
        id: user["id"],
        email: user["email"]!,
        name: user["name"],
        image: user["image"],
      };
    },
  })
);

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
      if (session["user"]) {
        session["user"]["id"] = user["id"];
        let organizationId: string | null = null;
        let role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" = "OWNER";
        let userLocale: string | null = null;
        try {
          const dbUser = await db["user"]["findUnique"]({
            where: { id: user["id"] },
            select: { organizationId: true, role: true, locale: true },
          });
          organizationId = dbUser?.["organizationId"] ?? null;
          role = dbUser?.["role"] ?? "OWNER";
          userLocale = dbUser?.["locale"] ?? null;
        } catch (err) {
          if (isMissingColumnError(err)) {
            try {
              const dbUser = await db["user"]["findUnique"]({
                where: { id: user["id"] },
                select: { organizationId: true, role: true },
              });
              organizationId = dbUser?.["organizationId"] ?? null;
              role = dbUser?.["role"] ?? "OWNER";
            } catch {
              // Fall through to defaults
            }
          }
          logServerError("auth session callback", err);
        }
        session["user"]["organizationId"] = organizationId;
        session["user"]["role"] = role;
        session["user"]["locale"] = userLocale;
      }
      return { ...session, appName: APP_NAME };
    },
    async redirect({ url, baseUrl }) {
      // Relative URLs (e.g. callbackUrl="/en/dashboard") are returned as-is.
      if (!url["startsWith"]("http")) {
        return url;
      }

      const target = new URL(url);
      const effectiveBaseUrl = baseUrl || target["origin"];
      const origin = new URL(effectiveBaseUrl);

      // If baseUrl is localhost but the target is the real production domain,
      // use the target's origin (proxy-aware fallback).
      if (target["origin"] === "http://localhost:3000" && origin["origin"] !== "http://localhost:3000") {
        const pathname = stripLocalePrefix(target["pathname"]);
        return `${target["origin"]}/${LOCALES[0]}${pathname}${target["search"]}${target["hash"]}`;
      }

      if (target["origin"] !== origin["origin"]) {
        return effectiveBaseUrl;
      }

      // Strip any existing locale prefix and ensure exactly one is added.
      // This prevents double-prefixing like /en/en/login.
      const pathname = stripLocalePrefix(target["pathname"]);
      return `${origin["origin"]}${ensureLocalePrefix(pathname)}${target["search"]}${target["hash"]}`;
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
