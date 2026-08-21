import { requireUser, requireFeature, getActivePlan } from "@/lib/org";
import { hasFeature } from "@/lib/plans";
import { db } from "@/lib/db";
import { logServerError } from "@/lib/errors";
import { EstimateForm } from "@/components/estimate-form";
import { getTranslations } from "next-intl/server";

export default async function NewEstimatePage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("estimates");
  await requireFeature("estimates");
  const user = await requireUser();
  if (!user || !user.organizationId) return null;
  const plan = await getActivePlan(user);
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
      <h1 className="text-2xl font-bold">{t("newEstimate")}</h1>
      <EstimateForm customers={customers} canUseCatalog={hasFeature(plan, "catalogItems")} />
    </div>
  );
}
