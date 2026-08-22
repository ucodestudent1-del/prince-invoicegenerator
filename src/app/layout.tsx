import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prince Invoice Generator",
  description: "Construction invoicing and project management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
