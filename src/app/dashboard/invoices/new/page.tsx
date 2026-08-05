import { requireUser, getCurrentOrg, getActivePlan } from "@/lib/org";
import { hasFeature } from "@/lib/plans";
import { db } from "@/lib/db";
import { logServerError } from "@/lib/errors";
import { InvoiceForm } from "@/components/invoice-form";

export default async function NewInvoicePage() {
  const user = await requireUser();
  if (!user.organizationId) return null;
  const orgId = user.organizationId;
  const plan = await getActivePlan(user);

  let customers;
  let projects;
  try {
    [customers, projects] = await Promise.all([
      db.customer.findMany({
        where: { orgId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      db.project.findMany({
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
        <h1 className="text-2xl font-bold">New invoice</h1>
        <p className="text-sm text-muted-foreground">
          Current plan: <strong>{plan}</strong>
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
      />
    </div>
  );
}