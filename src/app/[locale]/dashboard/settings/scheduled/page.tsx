import { Suspense } from "react";
import { getScheduledInvoices } from "@/lib/actions/invoices";
import { hasFeature } from "@/lib/plans";
import { getCurrentUser, getActivePlan } from "@/lib/org";
import { PricingFeature } from "@/components/pricing-feature";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";

export const metadata = {
  title: "Scheduled Invoices",
};

export default async function ScheduledPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("scheduled");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Button asChild>
          <Link href={`/${params.locale}/dashboard/invoices/new`}>
            <Plus className="mr-2 h-4 w-4" />
            {t("scheduleInvoice")}
          </Link>
        </Button>
      </div>
      <Suspense fallback={<p>Loading…</p>}>
        <ScheduledContent locale={params.locale} t={t} />
      </Suspense>
    </div>
  );
}

async function ScheduledContent({ locale, t }: { locale: string; t: any }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const plan = await getActivePlan(user);
  if (!hasFeature(plan, "scheduledInvoices")) {
    return <PricingFeature feature="scheduledInvoices" plan={plan} />;
  }

  const invoices = await getScheduledInvoices(user.organizationId!);

  if (invoices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("noScheduled")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {invoices.map((inv: any) => (
        <div key={inv.id} className="border rounded-md p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">{inv.title}</span>
            <span className="text-sm text-muted-foreground">
              {t("scheduledFor", { date: format(new Date(inv.scheduledFor), "PPP") })}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {inv.total} · {inv.status}
          </p>
        </div>
      ))}
    </div>
  );
}
