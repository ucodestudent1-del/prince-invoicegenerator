import { requireUser, requireFeature } from "@/lib/org";
import { db } from "@/lib/db";
import { logServerError } from "@/lib/errors";
import { EstimateForm } from "@/components/estimate-form";

export default async function NewEstimatePage() {
  await requireFeature("estimates");
  const user = await requireUser();
  if (!user.organizationId) return null;
  let customers;
  try {
    customers = await db.customer.findMany({
      where: { orgId: user.organizationId },
      orderBy: { name: "asc" },
    });
  } catch (err) {
    logServerError("NewEstimatePage", err);
    throw err;
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New estimate</h1>
      <EstimateForm customers={customers} />
    </div>
  );
}
