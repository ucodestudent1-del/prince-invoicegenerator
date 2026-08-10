import { requireUser, getCurrentOrg, getActivePlan } from "@/lib/org";
import { formatDate } from "@/lib/utils";
import { BillingPanel } from "@/components/billing-panel";
import { logServerError } from "@/lib/errors";

export default async function BillingPage() {
  const user = await requireUser();
  if (!user || !user.organizationId) return null;
  const orgId = user.organizationId;

   let org;
   try {
     org = await getCurrentOrg(user);
   } catch (err) {
     logServerError("BillingPage", err);
     throw err;
   }
   const plan = await getActivePlan(user);

  return (
    <BillingPanel
      plan={plan}
      status={org?.subscriptionStatus ?? null}
      renewalDate={org?.currentPeriodEnd ? formatDate(org.currentPeriodEnd) : null}
    />
  );
}
