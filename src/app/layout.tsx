import type { Metadata } from "next";
import { EB_Garamond } from "next/font/google";
import "./globals.css";

const ebGaramond = EB_Garamond({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Prince — Construction Invoice Generator",
  description:
    "Professional invoicing, estimates, change orders, and retainage tracking for construction contractors.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`min-h-screen antialiased ${ebGaramond.className}`}>{children}</body>
    </html>
  );
}
