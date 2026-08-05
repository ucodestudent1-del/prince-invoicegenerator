import { requireUser } from "@/lib/org";
import { ReminderSettingsForm } from "@/components/reminder-settings-form";
import { logServerError } from "@/lib/errors";

export default async function ReminderSettingsPage() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    logServerError("ReminderSettingsPage", err);
    throw err;
  }
  if (!user.organizationId) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Automated reminders</h1>
        <p className="text-sm text-muted-foreground">
          Configure automatic payment reminders for your invoices.
        </p>
      </div>
      <ReminderSettingsForm />
    </div>
  );
}
