import { Link } from "@/i18n/navigation";
import { redirect } from "@/i18n/navigation";
import { requireUser, ensureOrganization, getCurrentOrg, getActivePlan, ensureEnv, isMissingColumnError } from "@/lib/org";
import { hasFeature, type FeatureKey } from "@/lib/plans";
import {
  LayoutDashboard,
  FileText,
  Calculator,
  FolderKanban,
  Receipt,
  Users,
  UserPlus,
  Repeat,
  CreditCard,
  Lock,
  Settings,
  Bell,
  BarChart3,
  Calendar,
  Package,
  Clock,
} from "lucide-react";
import { logServerError } from "@/lib/errors";
import { UserMenu } from "@/components/user-menu";
import { Badge } from "@/components/ui/badge";
import { ThemeToggleForm } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getTranslations } from "next-intl/server";
import { getLocaleSafe } from "@/lib/locale";
import { APP_NAME } from "@/lib/app-name";
import { db } from "@/lib/db";

const nav = [
  { href: "/dashboard", label: "navigation.overview", icon: LayoutDashboard },
  { href: "/dashboard/invoices", label: "navigation.invoices", icon: FileText, feature: "invoicesPerMonth" as FeatureKey },
  { href: "/dashboard/unbilled-revenue", label: "navigation.unbilledRevenue", icon: Receipt },
  { href: "/dashboard/estimates", label: "navigation.estimates", icon: Calculator, feature: "estimates" as FeatureKey },
  { href: "/dashboard/settings/catalog", label: "navigation.catalog", icon: Package, feature: "catalogItems" as FeatureKey },
  { href: "/dashboard/time-tracking", label: "navigation.timeTracking", icon: Clock, feature: "timeTracking" as FeatureKey },
  { href: "/dashboard/change-orders", label: "navigation.changeOrders", icon: Repeat, feature: "changeOrders" as FeatureKey },
  { href: "/dashboard/projects", label: "navigation.projects", icon: FolderKanban, feature: "projectManagement" as FeatureKey },
  { href: "/dashboard/expenses", label: "navigation.expenses", icon: Receipt, feature: "expenseTracking" as FeatureKey },
  { href: "/dashboard/customers", label: "navigation.customers", icon: Users },
  { href: "/dashboard/subcontractors", label: "navigation.subcontractors", icon: UserPlus, feature: "subcontractorTracking" as FeatureKey },
  { href: "/dashboard/team", label: "navigation.team", icon: Users, feature: "multipleUsers" as FeatureKey },
  { href: "/dashboard/billing", label: "navigation.billing", icon: CreditCard },
  { href: "/dashboard/reports", label: "navigation.reports", icon: BarChart3 },
  { href: "/dashboard/recurring", label: "navigation.recurring", icon: Calendar, feature: "recurring" as FeatureKey },
   { href: "/dashboard/settings/reminders", label: "navigation.reminders", icon: Bell, feature: "automaticReminders" as FeatureKey },
    { href: "/dashboard/settings/late-fees", label: "navigation.lateFees", icon: Receipt, feature: "lateFees" as FeatureKey },
    { href: "/dashboard/settings", label: "navigation.settings", icon: Settings },
];

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  let user;
  let org;
  let plan;
  try {
    ensureEnv();
    user = await requireUser();
    org = (await getCurrentOrg(user)) ?? (await ensureOrganization(user["id"]));
    plan = await getActivePlan(user);
  } catch (err) {
    logServerError("DashboardLayout", err);
    throw err;
  }

  if (user && !user["emailVerified"]) {
    const locale = await getLocaleSafe();
    redirect({ href: "/verify-email?sent=1", locale });
    return null;
  }

  if (!org) {
    const locale = await getLocaleSafe();
    let onboardingState;
    try {
      onboardingState = await db["onboardingState"]["findUnique"]({
        where: { userId: user["id"] },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        redirect({ href: "/onboarding", locale });
      }
      throw err;
    }
    if (!onboardingState?.isComplete) {
      redirect({ href: "/onboarding", locale });
    }
    redirect({ href: "/pricing?error=no-org", locale });
    return null;
  }

  const t = await getTranslations("navigation");

  return (
    <div className={`flex min-h-screen ${org["theme"] === "dark" ? "dark" : ""}`}>
      <aside className="hidden w-60 flex-col border-r bg-muted/30 p-4 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 font-bold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs">
            P
          </span>
  {APP_NAME}
        </Link>
        <nav className="flex-1 space-y-1">
          {nav["map"]((item) => {
            const locked = item["feature"] && !hasFeature(plan, item["feature"]);
            return (
              <Link
                key={item["href"]}
                href={locked ? "/pricing?upgrade=1" : item["href"]}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {t(item["label"]["split"](".")[1] as any)}
                </span>
                {locked && <Lock className="h-3.5 w-3.5" />}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <div className="flex items-center gap-2">
            <Badge variant={plan === "FREE" ? "secondary" : "default"}>
              {t("planBadge", { plan })}
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <ThemeToggleForm current={org["theme"]} />
            <UserMenu email={user["email"]} name={user["name"]} />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
