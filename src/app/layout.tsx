import type { Metadata } from "next";
import "./globals.css";
import { ThemeClient } from "@/components/theme-client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMissingColumnError } from "@/lib/org";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Prince — Construction Invoice Generator",
  description:
    "Professional invoicing, estimates, change orders, and retainage tracking for construction contractors.",
};

async function getInitialTheme() {
  try {
    const cookieTheme = cookies().get("theme")?.value;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return {
        theme: cookieTheme === "dark" || cookieTheme === "light" ? cookieTheme : "light",
        brandColor: null,
        fontFamily: null,
      };
    }

    // Wrap in try/catch because the Organization table may not have
    // the new template/theme/brandColor/fontFamily columns yet
    // (migration 0003 hasn't been applied to the database).
    try {
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: {
          organization: {
            select: { theme: true, brandColor: true, fontFamily: true },
          },
        },
      });
      return {
        theme: user?.organization?.theme ?? cookieTheme ?? "light",
        brandColor: user?.organization?.brandColor ?? null,
        fontFamily: user?.organization?.fontFamily ?? null,
      };
    } catch (dbErr) {
      if (isMissingColumnError(dbErr) && cookieTheme) {
        return {
          theme: cookieTheme === "dark" ? "dark" : "light",
          brandColor: null,
          fontFamily: null,
        };
      }
      console.error("getInitialTheme DB error:", dbErr);
      return { theme: "light", brandColor: null, fontFamily: null };
    }
  } catch {
    return { theme: "light", brandColor: null, fontFamily: null };
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, brandColor, fontFamily } = await getInitialTheme();

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ThemeClient
          initialTheme={theme}
          brandColor={brandColor}
          fontFamily={fontFamily}
        />
        {children}
      </body>
    </html>
  );
}
