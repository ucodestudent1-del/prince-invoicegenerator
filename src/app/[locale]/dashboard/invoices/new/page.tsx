import { requireUser, getCurrentOrg, getActivePlan } from "@/lib/org";
import { hasFeature } from "@/lib/plans";
import { db } from "@/lib/db";
import { logServerError } from "@/lib/errors";
import { InvoiceForm } from "@/components/invoice-form";
import { getTranslations } from "next-intl/server";

export default async function NewInvoicePage({ params }: { params: { locale: string } }) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];
  const plan = await getActivePlan(user);
  const t = await getTranslations("invoices");

  let customers;
  let projects;
  try {
    [customers, projects] = await Promise["all"]([
      db["customer"]["findMany"]({
        where: { orgId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      db["project"]["findMany"]({
        where: { orgId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);
  } catch (err) {
    logServerError("NewInvoicePage", err);
    throw err;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("newInvoice")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("currentPlan", { plan })}
        </p>
      </div>
        <InvoiceForm
          customers={customers}
          projects={projects}
          canRetainage={hasFeature(plan, "retainage")}
          canProgress={hasFeature(plan, "progressInvoices")}
          canRecurring={hasFeature(plan, "recurring")}
          canCustomizeInvoiceNumber={true}
          canProjectManagement={hasFeature(plan, "projectManagement")}
          canSchedule={hasFeature(plan, "scheduledInvoices")}
          hasSavedAddresses={hasFeature(plan, "savedAddresses")}
          canUseCatalog={hasFeature(plan, "catalogItems")}
          canUseTimeTracking={hasFeature(plan, "timeTracking")}
        />
    </div>
  );
}