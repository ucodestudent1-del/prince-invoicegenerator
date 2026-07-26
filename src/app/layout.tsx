import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
