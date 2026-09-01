import type { NextAuthOptions, DefaultSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { APP_NAME } from "@/lib/app-name";
import { isMissingColumnError } from "@/lib/db-drift";
import { logServerError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

export { APP_NAME };

// ---------------------------------------------------------------------------
// Session lifetime (Plan 2.8)
// ---------------------------------------------------------------------------
// With the database strategy, `expires` is stamped at sign-in and pushed
// forward whenever a request arrives more than `updateAge` after the last
// refresh. The effective inactivity timeout therefore equals `maxAge`: a session
// that goes unused for that long can no longer be refreshed and is rejected.
//
// Defaults: 7-day inactivity window, refreshed at most once per hour so active
// users are not logged out mid-session. For a stricter 24-hour inactivity
// timeout set SESSION_MAX_AGE_SECONDS=86400.
const DEFAULT_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_SESSION_UPDATE_AGE_SECONDS = 60 * 60;

function positiveIntEnv(name: string, fallback: number): number {
  const raw = process["env"][name];
  if (!raw) return fallback;
  const parsed = Number["parseInt"](raw, 10);
  return Number["isFinite"](parsed) && parsed > 0 ? parsed : fallback;
}

const sessionMaxAge = positiveIntEnv("SESSION_MAX_AGE_SECONDS", DEFAULT_SESSION_MAX_AGE_SECONDS);
const sessionUpdateAge = Math["min"](
  positiveIntEnv("SESSION_UPDATE_AGE_SECONDS", DEFAULT_SESSION_UPDATE_AGE_SECONDS),
  sessionMaxAge
);

/**
 * Force `Secure` cookies (and the `__Secure-` name prefix) whenever the
 * canonical URL is HTTPS, instead of relying on NODE_ENV. This keeps local HTTP
 * development working while guaranteeing secure cookies on any HTTPS host.
 */
function shouldUseSecureCookies(): boolean {
  const url = process["env"]["NEXTAUTH_URL"] || process["env"]["NEXT_PUBLIC_BASE_URL"];
  if (url) return url["startsWith"]("https://");
  return process["env"]["NODE_ENV"] === "production";
}

/** Best-effort client attribution from the NextAuth internal request. */
function requestAttribution(req: unknown): { ip?: string; userAgent?: string } {
  const headers = (req as { headers?: Record<string, string | undefined> } | undefined)?.["headers"];
  if (!headers) return {};
  const forwarded = headers["x-forwarded-for"];
  return {
    ip: forwarded?.["split"](",")[0]?.["trim"]() || headers["x-real-ip"] || undefined,
    userAgent: headers["user-agent"],
  };
}

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
    async authorize(credentials, req) {
      if (!credentials?.["email"] || !credentials?.["password"]) {
        return null;
      }

      const normalizedEmail = credentials["email"]["toLowerCase"]();
      const attribution = requestAttribution(req);

      // Audit every failure path with the same shape so brute-force attempts
      // are visible without disclosing which factor was wrong.
      const auditFailure = (reason: string) =>
        void recordAudit({
          category: "AUTH",
          action: "LOGIN_FAILED",
          outcome: "FAILURE",
          actorEmail: normalizedEmail,
          targetType: "User",
          metadata: { reason, provider: "credentials" },
          ...attribution,
        });

      const user = await db["user"]["findUnique"]({
        where: { email: normalizedEmail },
      });

      if (!user || !user["password"]) {
        auditFailure(user ? "no-password-credential" : "unknown-account");
        return null;
      }

      const isValid = await bcrypt["compare"](credentials["password"], user["password"]);
      if (!isValid) {
        auditFailure("bad-password");
        return null;
      }

      void recordAudit({
        category: "AUTH",
        action: "LOGIN_SUCCESS",
        actorId: user["id"],
        actorEmail: user["email"],
        orgId: user["organizationId"],
        targetType: "User",
        targetId: user["id"],
        metadata: { provider: "credentials" },
        ...attribution,
      });

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
  session: {
    strategy: "database",
    maxAge: sessionMaxAge,
    updateAge: sessionUpdateAge,
  },
  useSecureCookies: shouldUseSecureCookies(),
  theme: {
    brandColor: "#ea5804",
    colorScheme: "auto",
  },
  events: {
    // OAuth sign-ins never reach the credentials provider, so they are audited
    // here. Credentials sign-ins are audited in `authorize` where the failure
    // reason is known; this event records the successful completion for both.
    async signIn({ user, account, isNewUser }) {
      void recordAudit({
        category: "AUTH",
        action: isNewUser ? "SIGNUP" : "LOGIN_SUCCESS",
        actorId: user?.["id"],
        actorEmail: user?.["email"],
        targetType: "User",
        targetId: user?.["id"],
        metadata: { provider: account?.["provider"] ?? "unknown", isNewUser: Boolean(isNewUser) },
      });
    },
    async signOut({ session }) {
      const userId = (session as { userId?: string } | undefined)?.["userId"];
      void recordAudit({
        category: "AUTH",
        action: "LOGOUT",
        actorId: userId,
        targetType: "User",
        targetId: userId,
      });
    },
  },
  callbacks: {
    async session({ session, user }) {
      if (session["user"]) {
        session["user"]["id"] = user["id"];
        let organizationId: string | null = null;
        let role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" = "OWNER";
        let userLocale: string | null = null;
        let emailVerified: Date | null = null;
        try {
          const dbUser = await db["user"]["findUnique"]({
            where: { id: user["id"] },
            select: { organizationId: true, role: true, locale: true, emailVerified: true },
          });
          // Coerce null DB values to typed null. `?? null` collapses
          // `undefined` (when the row is missing) and the SQL NULL into a
          // single observable shape so call sites do not have to defend
          // against both.
          organizationId = dbUser?.["organizationId"] ?? null;
          role = dbUser?.["role"] ?? "OWNER";
          userLocale = dbUser?.["locale"] ?? null;
          emailVerified = dbUser?.["emailVerified"] ?? null;
        } catch (err) {
          if (isMissingColumnError(err)) {
            try {
              const dbUser = await db["user"]["findUnique"]({
                where: { id: user["id"] },
                select: { organizationId: true, role: true },
              });
              organizationId = dbUser?.["organizationId"] ?? null;
              role = dbUser?.["role"] ?? "OWNER";
              // Fail closed on the verification flag: when the column is
              // missing (schema drift) we must NOT mark the user as
              // verified, because that would let any account through the
              // `ensureVerified()` gate. Route-level checks (e.g.
              // `ensureVerified()`) will surface the missing column as a
              // 403 and the operator can fix the migration without
              // silently downgrading security.
              emailVerified = null;
             } catch (fallbackErr) {
              logServerError("auth session callback (fallback query)", fallbackErr);
            }
          }
          logServerError("auth session callback", err);
        }
        session["user"]["organizationId"] = organizationId;
        session["user"]["role"] = role;
        session["user"]["locale"] = userLocale;
        session["user"]["emailVerified"] = emailVerified;
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
      if (!effectiveBaseUrl) {
        return `${target.origin}${target.pathname}${target.search}${target.hash}`;
      }
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
      emailVerified: Date | null;
    } & DefaultSession["user"];
  }

  interface JWT {
    appName?: string;
  }
}
