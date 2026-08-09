import Link from "next/link";
import { HardHat } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function SiteHeader({ cta = true }: { cta?: boolean }) {
  const t = await getTranslations("navigation");

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HardHat className="h-5 w-5" />
          </span>
          {t("appName")}
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link href="/#features" className="text-muted-foreground hover:text-foreground">
            {t("features")}
          </Link>
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
            {t("pricing")}
          </Link>
          <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
            {t("privacy")}
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t("signIn")}
          </Link>
          {cta && (
            <Link
              href="/pricing"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              {t("pricing")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const t = await getTranslations("navigation");

  return (
    <footer className="border-t py-8">
      <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
        <p>© {new Date().getFullYear()} Prince Invoice Generator. All rights reserved.</p>
        <div className="flex gap-4">
          <Link href="/pricing" className="hover:text-foreground">
            {t("pricing")}
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            {t("terms")}
          </Link>
          <Link href="/support" className="hover:text-foreground">
            {t("support")}
          </Link>
          <Link href="/login" className="hover:text-foreground">
            {t("signIn")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
