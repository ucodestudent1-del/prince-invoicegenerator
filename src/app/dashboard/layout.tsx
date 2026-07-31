import Link from "next/link";
import { requireUser, ensureOrganization, getCurrentOrg, getActivePlan } from "@/lib/org";
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
} from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { Badge } from "@/components/ui/badge";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/invoices", label: "Invoices", icon: FileText, feature: "invoicesPerMonth" as FeatureKey },
  { href: "/dashboard/estimates", label: "Estimates", icon: Calculator, feature: "estimates" as FeatureKey },
  { href: "/dashboard/change-orders", label: "Change Orders", icon: Repeat, feature: "changeOrders" as FeatureKey },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban, feature: "projectManagement" as FeatureKey },
  { href: "/dashboard/expenses", label: "Expenses", icon: Receipt, feature: "expenseTracking" as FeatureKey },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/subcontractors", label: "Subcontractors", icon: UserPlus, feature: "subcontractorTracking" as FeatureKey },
  { href: "/dashboard/team", label: "Team", icon: Users, feature: "multipleUsers" as FeatureKey },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
];

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  let org;
  let plan;
  try {
    user = await requireUser();
    org = (await getCurrentOrg()) ?? (await ensureOrganization(user.id));
    plan = await getActivePlan();
  } catch (err) {
    console.error("DashboardLayout failed to load auth/org/plan:", err);
    throw err;
  }

  if (!org) {
    throw new Error("Organization not found");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 flex-col border-r bg-muted/30 p-4 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 font-bold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs">
            P
          </span>
          Prince
        </Link>
        <nav className="flex-1 space-y-1">
          {nav.map((item) => {
            const locked = item.feature && !hasFeature(plan, item.feature);
            return (
              <Link
                key={item.href}
                href={locked ? "/pricing?upgrade=1" : item.href}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
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
              {plan} plan
            </Badge>
          </div>
          <UserMenu email={user.email} name={user.name} />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
