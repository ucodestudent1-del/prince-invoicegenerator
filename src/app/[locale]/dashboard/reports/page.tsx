import { requireUser } from "@/lib/org";
import { ReportsView } from "@/components/reports-view";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";

export default async function ReportsPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("reports");
  try {
    await requireUser();
  } catch (err) {
    logServerError("ReportsPage", err);
    throw err;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2ls font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <ReportsView />
    </div>
  );
}
