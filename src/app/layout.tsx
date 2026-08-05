import type { Metadata } from "next";
import "./globals.css";
import { ThemeClient } from "@/components/theme-client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Prince — Construction Invoice Generator",
  description:
    "Professional invoicing, estimates, change orders, and retainage tracking for construction contractors.",
};

async function getInitialTheme() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { theme: "light", brandColor: null };
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        organization: {
          select: { theme: true, brandColor: true, fontFamily: true },
        },
      },
    });
    return {
      theme: user?.organization?.theme ?? "light",
      brandColor: user?.organization?.brandColor ?? null,
      fontFamily: user?.organization?.fontFamily ?? null,
    };
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
