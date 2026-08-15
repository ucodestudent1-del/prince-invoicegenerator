import { Link } from "@/i18n/navigation";
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
  deleteOrganization,
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
import { getTranslations } from "next-intl/server";

interface Section {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => Promise<{ count: number }>;
}

export default async function SettingsPage({ params }: { params: { locale: string } }) {
  const user = await requireUser();
  if (!user || !user.organizationId) return null;
  const orgId = user.organizationId;
  const canManageData = user.role === "OWNER" || user.role === "ADMIN";
  const t = await getTranslations("settings");

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

  const sections: Section[] = [
    { key: "projects", label: t("projects"), icon: FolderKanban, action: removeAllProjects },
    { key: "estimates", label: t("estimates"), icon: Calculator, action: removeAllEstimates },
    { key: "changeOrders", label: t("changeOrders"), icon: Repeat, action: removeAllChangeOrders },
    { key: "expenses", label: t("expenses"), icon: Receipt, action: removeAllExpenses },
    { key: "customers", label: t("customers"), icon: Users, action: removeAllCustomers },
    { key: "subcontractors", label: t("subcontractors"), icon: UserPlus, action: removeAllSubcontractors },
    { key: "team", label: t("teamMembers"), icon: Users, action: removeAllTeamMembers },
  ];

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("billing")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("billingDesc")}
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/billing">{t("openBilling")}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("automatedReminders")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("remindersDesc")}
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/settings/reminders">{t("openReminders")}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("lateFees")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("lateFeesDesc")}
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/settings/late-fees">{t("openLateFees")}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("dataManagement")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("dataDesc")}
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
                      message={`${t("remove")} all ${s.label.toLowerCase()}? ${t("confirm")}`}
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
          <CardTitle className="text-lg text-destructive">{t("deleteOrganization")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("deleteWarning")}
          </p>
        </CardHeader>
        <CardContent>
          {canManageData ? (
            <form
              action={async () => {
                "use server";
                await deleteOrganization();
              }}
            >
              <ConfirmSubmit
                message={t("deleteWarning")}
              />
            </form>
          ) : (
            <Badge variant="secondary">
              {t("ownerRequired")}
            </Badge>
          )}
        </CardContent>
      </Card>

      {!canManageData && (
        <p className="text-sm text-muted-foreground">
          {t("deleteWarning")}
        </p>
      )}
    </div>
  );
}
