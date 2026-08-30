import { requireUser, requireFeature } from "@/lib/org";
import { ExpenseForm } from "@/components/expense-form";
import { isR2Configured } from "@/lib/r2";
import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export default async function NewExpensePage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("expenses");
  await requireFeature("expenseTracking");
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const r2 = isR2Configured();

  let projects: { id: string; name: string }[] = [];
  try {
    projects = await db["project"]["findMany"]({
      where: { orgId: user["organizationId"] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  } catch (err) {
    projects = [];
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("newExpense")}</h1>
      <ExpenseForm r2Enabled={r2} projects={projects} />
    </div>
  );
}
