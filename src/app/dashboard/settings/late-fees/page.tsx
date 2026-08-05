import { requireUser } from "@/lib/org";
import { LateFeeSettingsForm } from "@/components/late-fee-settings-form";
import { logServerError } from "@/lib/errors";

export default async function LateFeesPage() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    logServerError("LateFeesPage", err);
    throw err;
  }
  if (!user.organizationId) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Late fees</h1>
        <p className="text-sm text-muted-foreground">
          Configure automatic late fee calculation and application for overdue invoices.
        </p>
      </div>
      <LateFeeSettingsForm />
    </div>
  );
}
