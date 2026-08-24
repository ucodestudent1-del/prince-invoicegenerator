import { requireUser, requireFeature, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { logServerError } from "@/lib/errors";
import { ChangeOrderForm } from "@/components/change-order-form";
import { getTranslations } from "next-intl/server";

export default async function NewChangeOrderPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("changeOrders");
  await requireFeature("changeOrders");
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  let invoices;
  try {
    invoices = await db["invoice"]["findMany"]({
      where: { orgId: user["organizationId"] },
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
      },
    });
  } catch (err) {
    if (isMissingColumnError(err)) {
      invoices = await db["invoice"]["findMany"]({
        where: { orgId: user["organizationId"] },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
        },
      }) as any;
    } else {
      logServerError("NewChangeOrderPage", err);
      throw err;
    }
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("newChangeOrder")}</h1>
      <ChangeOrderForm invoices={invoices} />
    </div>
  );
}
