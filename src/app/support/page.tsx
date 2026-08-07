import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, BookOpen, MessageSquare } from "lucide-react";

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

export const metadata = {
  title: "Support — Prince Invoice Generator",
  description: "Get help with Prince Invoice Generator. Find documentation, email support, and submit feedback.",
};

export default function SupportPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="container py-16 max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight">Support</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;re here to help you get the most out of Prince Invoice Generator.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {supportOptions.map((option) => (
              <Card key={option.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <option.icon className="h-4 w-4" />
                    </span>
                    {option.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                  <Button asChild variant="outline" size="sm">
                    <a href={option.href}>{option.label}</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 rounded-lg border p-6">
            <h2 className="text-lg font-semibold">Common topics</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Getting started and creating your first invoice</li>
              <li>Setting up Stripe payments and subscriptions</li>
              <li>Configuring team roles and permissions</li>
              <li>Importing customers and projects</li>
              <li>Troubleshooting login or OAuth issues</li>
              <li>Understanding invoice limits by plan</li>
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
