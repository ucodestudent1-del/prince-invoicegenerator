import { requireUser } from "@/lib/org";
import { db } from "@/lib/db";
import { RecurringConfigForm } from "@/components/recurring-config-form";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";

export default async function NewRecurringPage({ params }: { params: { locale: string } }) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];
  const t = await getTranslations("recurring");

  let customers;
  let projects;
  try {
    [customers, projects] = await Promise["all"]([
      db["customer"]["findMany"]({
        where: { orgId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db["project"]["findMany"]({
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
        <h1 className="text-2xl font-bold">{t("newConfig")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("newConfigDesc")}
        </p>
      </div>
      <RecurringConfigForm customers={customers} projects={projects} />
    </div>
  );
}
