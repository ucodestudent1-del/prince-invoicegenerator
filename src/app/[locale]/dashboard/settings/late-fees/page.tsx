import { requireUser, requireFeature } from "@/lib/org";
import { LateFeeSettingsForm } from "@/components/late-fee-settings-form";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";

export default async function LateFeesPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("lateFees");
  let user;
  try {
    await requireFeature("lateFees");
    user = await requireUser();
  } catch (err) {
    logServerError("LateFeesPage", err);
    throw err;
  }
  if (!user || !user["organizationId"]) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <LateFeeSettingsForm />
    </div>
  );
}
