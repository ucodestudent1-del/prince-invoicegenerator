import { requireUser, requireFeature, getCurrentOrg } from "@/lib/org";
import { db } from "@/lib/db";
import { EstimateForm } from "@/components/estimate-form";

export default async function NewEstimatePage() {
  await requireFeature("estimates");
  const user = await requireUser();
  if (!user.organizationId) return null;
  const customers = await db.customer.findMany({
    where: { orgId: user.organizationId },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New estimate</h1>
      <EstimateForm customers={customers} />
    </div>
  );
}
