import { requireUser, requireFeature, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { getAvailableInvoices } from "@/lib/actions/invoices";
import { ChangeOrderForm } from "@/components/change-order-form";
import { getTranslations } from "next-intl/server";
import { logServerError } from "@/lib/errors";

export default async function NewChangeOrderPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("changeOrders");
  await requireFeature("changeOrders");
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];

  const invoices = await getAvailableInvoices();

  let customers: { id: string; name: string; company: string | null }[] = [];
  let projects: { id: string; name: string; number: string | null }[] = [];
  try {
    [customers, projects] = await Promise["all"]([
      db["customer"]["findMany"]({
        where: { orgId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, company: true },
      }),
      db["project"]["findMany"]({
        where: { orgId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, number: true },
      }),
    ]);
  } catch (err) {
    if (isMissingColumnError(err)) {
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
      ]) as [typeof customers, typeof projects];
    } else {
      logServerError("NewChangeOrderPage", err);
      throw err;
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("newChangeOrder")}</h1>
      <ChangeOrderForm invoices={invoices} customers={customers} projects={projects} />
    </div>
  );
}
