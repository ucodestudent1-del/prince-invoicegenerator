import { requireUser, getCurrentOrg, getActivePlan } from "@/lib/org";
import { formatDate } from "@/lib/utils";
import { BillingPanel } from "@/components/billing-panel";

export default async function BillingPage() {
  const user = await requireUser();
  if (!user.organizationId) return null;
  const org = await getCurrentOrg();
  const plan = await getActivePlan();

  return (
    <BillingPanel
      plan={plan}
      status={org?.subscriptionStatus ?? null}
      renewalDate={org?.currentPeriodEnd ? formatDate(org.currentPeriodEnd) : null}
    />
  );
}
