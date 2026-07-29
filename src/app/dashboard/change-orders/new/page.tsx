import { requireUser, requireFeature } from "@/lib/org";
import { db } from "@/lib/db";
import { ChangeOrderForm } from "@/components/change-order-form";

export default async function NewChangeOrderPage() {
  await requireFeature("changeOrders");
  const user = await requireUser();
  if (!user.organizationId) return null;
  const invoices = await db.invoice.findMany({ where: { orgId: user.organizationId }, orderBy: { number: "asc" } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New change order</h1>
      <ChangeOrderForm invoices={invoices} />
    </div>
  );
}
