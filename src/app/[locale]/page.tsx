import { Link } from "@/i18n/navigation";
import { HardHat, FileText, Calculator, Camera, Users, Repeat, ShieldCheck } from "lucide-react";
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
        <section className="container py-20 text-center">
          <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium">
            {t("heroTitle")}
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            {t("heroSubtitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t("heroDescription")}
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/pricing">{t("seePricing")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">
                <HardHat className="mr-2 h-4 w-4" /> {t("tryFree")}
              </Link>
            </Button>
          </div>
        </section>

        <section id="features" className="container py-12">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title}>
                <CardContent className="pt-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
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
