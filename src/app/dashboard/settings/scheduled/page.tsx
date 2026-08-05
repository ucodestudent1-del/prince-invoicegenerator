import { Suspense } from "react";
import { getScheduledInvoices } from "@/lib/actions/invoices";
import { hasFeature } from "@/lib/plans";
import { getCurrentUser, getActivePlan } from "@/lib/org";
import { PricingFeature } from "@/components/pricing-feature";
import { Calendar } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export const metadata = {
  title: "Scheduled Invoices",
};

export default async function ScheduledPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scheduled Invoices</h1>
          <p className="text-muted-foreground">
            Invoices scheduled to be sent on a future date.
          </p>
        </div>
        <Link href="/dashboard/invoices/new">
          <Calendar className="h-4 w-4 inline mr-2" />
          Schedule invoice
        </Link>
      </div>
      <Suspense fallback={<p>Loading…</p>}>
        <ScheduledContent />
      </Suspense>
    </div>
  );
}

async function ScheduledContent() {
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
        No scheduled invoices yet.
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
              Scheduled for {format(new Date(inv.scheduledFor), "PPP")}
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
