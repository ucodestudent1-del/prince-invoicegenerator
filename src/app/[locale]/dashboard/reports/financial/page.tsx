import { requireUser } from "@/lib/org";
import { FinancialDashboard } from "@/components/financial-dashboard";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";

export default async function FinancialDashboardPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("reports");
  try {
    await requireUser();
  } catch (err) {
    logServerError("FinancialDashboardPage", err);
    throw err;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("financialDashboard")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("financialDashboardDesc")}
        </p>
      </div>
      <FinancialDashboard />
    </div>
  );
}
