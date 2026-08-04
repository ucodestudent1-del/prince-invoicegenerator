import { requireUser } from "@/lib/org";
import { db } from "@/lib/db";
import {
  removeAllProjects,
  removeAllEstimates,
  removeAllChangeOrders,
  removeAllExpenses,
  removeAllCustomers,
  removeAllTeamMembers,
  removeAllSubcontractors,
} from "@/lib/actions/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  Calculator,
  Repeat,
  Receipt,
  Users,
  UserPlus,
  Trash2,
} from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { logServerError } from "@/lib/errors";

interface Section {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => Promise<{ count: number }>;
}

const sections: Section[] = [
  { key: "projects", label: "Projects", icon: FolderKanban, action: removeAllProjects },
  { key: "estimates", label: "Estimates", icon: Calculator, action: removeAllEstimates },
  { key: "changeOrders", label: "Change orders", icon: Repeat, action: removeAllChangeOrders },
  { key: "expenses", label: "Expenses", icon: Receipt, action: removeAllExpenses },
  { key: "customers", label: "Customers", icon: Users, action: removeAllCustomers },
  { key: "subcontractors", label: "Subcontractors", icon: UserPlus, action: removeAllSubcontractors },
  { key: "team", label: "Team members", icon: Users, action: removeAllTeamMembers },
];

export default async function SettingsPage() {
  const user = await requireUser();
  if (!user.organizationId) return null;
  const orgId = user.organizationId;
  const canManageData = user.role === "OWNER" || user.role === "ADMIN";

  let counts: Record<string, number>;
  try {
    const [
      projects,
      estimates,
      changeOrders,
      expenses,
      customers,
      subcontractors,
      team,
    ] = await Promise.all([
      db.project.count({ where: { orgId } }),
      db.estimate.count({ where: { orgId } }),
      db.changeOrder.count({ where: { orgId } }),
      db.expense.count({ where: { orgId } }),
      db.customer.count({ where: { orgId } }),
      db.subcontractor.count({ where: { orgId } }),
      db.user.count({ where: { organizationId: orgId } }),
    ]);
    counts = {
      projects,
      estimates,
      changeOrders,
      expenses,
      customers,
      subcontractors,
      team,
    };
  } catch (err) {
    logServerError("SettingsPage", err);
    counts = {
      projects: 0,
      estimates: 0,
      changeOrders: 0,
      expenses: 0,
      customers: 0,
      subcontractors: 0,
      team: 0,
    };
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization preferences and data.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Billing</CardTitle>
          <p className="text-sm text-muted-foreground">
            Update your subscription, payment method, and view upcoming renewals.
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <a href="/dashboard/billing">Open billing settings</a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data management</CardTitle>
          <p className="text-sm text-muted-foreground">
            Permanently remove past records for your organization. Each action
            deletes every record of that type (and its dependents) and cannot
            be undone.
          </p>
        </CardHeader>
        <CardContent className="space-y-1">
          {sections.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between rounded-md border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <s.icon className="h-4 w-4" />
                </span>
                <span className="font-medium">{s.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{counts[s.key] ?? 0} record(s)</Badge>
                {canManageData ? (
                  <form
                    action={async () => {
                      "use server";
                      await s.action();
                    }}
                  >
                    <ConfirmSubmit
                      message={`Remove all ${s.label.toLowerCase()}? This cannot be undone.`}
                    />
                  </form>
                ) : (
                  <Trash2 className="h-4 w-4 text-muted-foreground/50" />
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Delete organization</CardTitle>
          <p className="text-sm text-muted-foreground">
            Removing your organization permanently deletes all of its data and
            cancels any active subscription. This cannot be undone.
          </p>
        </CardHeader>
        <CardContent>
          <Badge variant={canManageData ? "destructive" : "secondary"}>
            {canManageData
              ? "Contact support to delete your organization."
              : "Owner or admin access required."}
          </Badge>
        </CardContent>
      </Card>

      {!canManageData && (
        <p className="text-sm text-muted-foreground">
          Only owners and admins can remove organization data. Ask an admin to
          make changes, or contact support.
        </p>
      )}
    </div>
  );
}
