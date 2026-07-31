import { requireUser, getCurrentOrg, getActivePlan } from "@/lib/org";
import { formatDate } from "@/lib/utils";
import { BillingPanel } from "@/components/billing-panel";

export default async function BillingPage() {
  const user = await requireUser();
  if (!user.organizationId) return null;
  const orgId = user.organizationId;

  let org;
  try {
    org = await getCurrentOrg();
  } catch (err) {
    console.error("BillingPage failed to load org:", err);
    throw err;
  }
  const plan = await getActivePlan();

  return (
    <BillingPanel
      plan={plan}
      status={org?.subscriptionStatus ?? null}
      renewalDate={org?.currentPeriodEnd ? formatDate(org.currentPeriodEnd) : null}
    />
  );
}
