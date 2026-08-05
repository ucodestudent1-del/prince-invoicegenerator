import { requireUser } from "@/lib/org";
import { ReportsView } from "@/components/reports-view";
import { logServerError } from "@/lib/errors";

export default async function ReportsPage() {
  try {
    await requireUser();
  } catch (err) {
    logServerError("ReportsPage", err);
    throw err;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2ls font-bold">Reports & analytics</h1>
        <p className="text-sm text-muted-foreground">
          Track revenue, outstanding balances, taxes, and customer spending.
        </p>
      </div>
      <ReportsView />
    </div>
  );
}
