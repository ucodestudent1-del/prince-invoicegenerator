import { requireUser, requireFeature } from "@/lib/org";
import { isMissingColumnError } from "@/lib/db-drift";
import { getAvailableInvoices } from "@/lib/actions/invoices";
import { ChangeOrderForm } from "@/components/change-order-form";
import { getTranslations } from "next-intl/server";

export default async function NewChangeOrderPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("changeOrders");
  await requireFeature("changeOrders");
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;

  // Plan C4: use the bounded `getAvailableInvoices` action (take: 200) so
  // the dropdown does not grow with the customer's history. A `q` search
  // input on the page can narrow the list further.
  const invoices = await getAvailableInvoices();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("newChangeOrder")}</h1>
      <ChangeOrderForm invoices={invoices} />
    </div>
  );
}
