import { Suspense } from "react";
import { requireUser } from "@/lib/org";
import { ReminderSettingsForm } from "@/components/reminder-settings-form";
import { hasFeature } from "@/lib/plans";
import { getCurrentUser, getActivePlan } from "@/lib/org";
import { PricingFeature } from "@/components/pricing-feature";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";

export const metadata = {
  title: "Automated Reminders",
};

export default async function ReminderSettingsPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("reminders");
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    logServerError("ReminderSettingsPage", err);
    throw err;
  }
  if (!user || !user["organizationId"]) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <Suspense fallback={<p>{t("loadingSettings")}</p>}>
        <ReminderSettingsContent t={t} />
      </Suspense>
    </div>
  );
}

async function ReminderSettingsContent({ t }: { t: any }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const plan = await getActivePlan(user);

  if (!hasFeature(plan, "automaticReminders")) {
    return <PricingFeature feature="automaticReminders" plan={plan} />;
  }

  return <ReminderSettingsForm />;
}
