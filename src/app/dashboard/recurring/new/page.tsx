import { requireUser } from "@/lib/org";
import { db } from "@/lib/db";
import { RecurringConfigForm } from "@/components/recurring-config-form";
import { logServerError } from "@/lib/errors";

export default async function NewRecurringPage() {
  const user = await requireUser();
  if (!user.organizationId) return null;
  const orgId = user.organizationId;

  let customers;
  let projects;
  try {
    [customers, projects] = await Promise.all([
      db.customer.findMany({
        where: { orgId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.project.findMany({
        where: { orgId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
  } catch (err) {
    logServerError("NewRecurringPage", err);
    throw err;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">New recurring configuration</h1>
        <p className="text-sm text-muted-foreground">
          Set up automatic invoice generation for repeat customers.
        </p>
      </div>
      <RecurringConfigForm customers={customers} projects={projects} />
    </div>
  );
}
