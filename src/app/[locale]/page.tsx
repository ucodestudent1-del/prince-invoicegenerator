import { Link } from "@/i18n/navigation";
import { FileText, Calculator, Camera, Users, Repeat, ShieldCheck } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("home");

  const features = [
    {
      icon: FileText,
      title: t("features.invoices"),
      body: t("features.invoicesDesc"),
    },
    {
      icon: Calculator,
      title: t("features.estimates"),
      body: t("features.estimatesDesc"),
    },
    {
      icon: Repeat,
      title: t("features.recurring"),
      body: t("features.recurringDesc"),
    },
    {
      icon: Camera,
      title: t("features.photos"),
      body: t("features.photosDesc"),
    },
    {
      icon: Users,
      title: t("features.customers"),
      body: t("features.customersDesc"),
    },
    {
      icon: ShieldCheck,
      title: t("features.reports"),
      body: t("features.reportsDesc"),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="container grid items-center gap-12 py-24 md:py-32 lg:grid-cols-7 lg:gap-16">
          <div className="flex flex-col items-start gap-6 lg:col-span-4">
            <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {t("heroTitle")}
            </span>
            <h1 className="font-serif text-4xl font-medium tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {t("heroSubtitle")}
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              {t("heroDescription")}
            </p>
            <div className="flex items-center gap-3">
              <Button asChild size="lg">
                <Link href="/pricing">{t("tryFree")}</Link>
              </Button>
              <Button asChild size="lg" variant="link" className="px-0">
                <Link href="/#features">{t("seePricing")}</Link>
              </Button>
            </div>
          </div>
          <div className="relative lg:col-span-3">
            <div className="relative mx-auto h-64 w-full max-w-xs rounded-2xl border bg-gradient-to-br from-primary/5 to-background">
              <div className="absolute -top-6 -left-6 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
              <div className="absolute -bottom-5 -right-7 h-20 w-20 rounded-full bg-accent blur-xl" />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="container py-16 md:py-24">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features["map"]((f) => (
              <Card key={f["title"]}>
                <CardContent className="pt-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{f["title"]}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f["body"]}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
