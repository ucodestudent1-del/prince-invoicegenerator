import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, BookOpen, MessageSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
	title: "Support",
	description:
		"Get help with Prince. Documentation, support tickets, and product feedback channels.",
	alternates: { canonical: "/support" },
};

const supportOptions = [
  {
    icon: BookOpen,
    title: "Documentation",
    description: "Browse guides and how-tos for invoices, estimates, and team settings.",
    href: "/privacy",
    label: "View docs",
  },
  {
    icon: Mail,
    title: "Email support",
    description: "Reach our support team at privacy@prince-invoice.com.",
    href: "mailto:privacy@prince-invoice.com",
    label: "Send email",
  },
  {
    icon: MessageSquare,
    title: "Feedback",
    description: "Have a feature request or bug report? We'd love to hear it.",
    href: "mailto:privacy@prince-invoice.com?subject=Feedback",
    label: "Share feedback",
  },
];

export default async function SupportPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("support");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="container py-16 max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("subtitle")}
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {supportOptions["map"]((option) => (
              <Card key={option["title"]}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <option.icon className="h-4 w-4" />
                    </span>
                    {option["title"]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{option["description"]}</p>
                  <Button asChild variant="outline" size="sm">
                    <a href={option["href"]}>{option["label"]}</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 rounded-lg border p-6">
            <h2 className="text-lg font-semibold">{t("commonTopics")}</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>{t("topic1")}</li>
              <li>{t("topic2")}</li>
              <li>{t("topic3")}</li>
              <li>{t("topic4")}</li>
              <li>{t("topic5")}</li>
              <li>{t("topic6")}</li>
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
