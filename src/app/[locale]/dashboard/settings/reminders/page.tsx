import { requireUser } from "@/lib/org";
import { ReminderSettingsForm } from "@/components/reminder-settings-form";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";

export default async function ReminderSettingsPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("reminders");
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    logServerError("ReminderSettingsPage", err);
    throw err;
  }
  if (!user || !user.organizationId) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <ReminderSettingsForm />
    </div>
  );
}
