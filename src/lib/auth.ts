import type { NextAuthOptions, DefaultSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { APP_NAME } from "@/lib/app-name";

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
  pages: {
    signIn: "/login",
  },
  theme: {
    brandColor: "#ea5804",
    colorScheme: "auto",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { organizationId: true, role: true },
        });
        session.user.organizationId = dbUser?.organizationId ?? null;
        session.user.role = dbUser?.role ?? "OWNER";
      }
      return { ...session, appName: APP_NAME };
    },
  },
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organizationId: string | null;
      role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
    } & DefaultSession["user"];
  }

  interface JWT {
    appName?: string;
  }
}
