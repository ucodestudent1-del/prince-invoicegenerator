import Link from "next/link";
import { HardHat, FileText, Calculator, Camera, Users, Repeat, ShieldCheck } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: FileText,
    title: "Invoices & AIA progress billing",
    body: "Create professional invoices with line items, tax, discounts, and retainage tracking for progress billing.",
  },
  {
    icon: Calculator,
    title: "Estimates & quotes",
    body: "Send detailed estimates that convert into invoices with one click.",
  },
  {
    icon: Repeat,
    title: "Recurring invoices",
    body: "Automate monthly or project-based billing so you get paid on time.",
  },
  {
    icon: Camera,
    title: "Photo attachments",
    body: "Attach jobsite photos to expenses and invoices stored on Cloudflare R2.",
  },
  {
    icon: Users,
    title: "Customers & subcontractors",
    body: "Maintain a customer database and track subcontractor assignments per project.",
  },
  {
    icon: ShieldCheck,
    title: "Change orders & reports",
    body: "Manage change orders and generate reports for growing construction companies.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="container py-20 text-center">
          <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium">
            Built for construction contractors
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Invoicing that speaks the language of construction
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Progress invoices, change orders, retainage, and customer management —
            all in one place. Start free, upgrade as your crew grows.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/pricing">See pricing</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">
                <HardHat className="mr-2 h-4 w-4" /> Try it free
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
