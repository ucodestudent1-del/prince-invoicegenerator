import { requireUser } from "@/lib/org";
import { redirect } from "@/i18n/navigation";
import { getLocaleSafe } from "@/lib/locale";
import { logServerError } from "@/lib/errors";

export default async function FinancialDashboardPage({ params }: { params: { locale: string } }) {
  try {
    await requireUser();
  } catch (err) {
    logServerError("FinancialDashboardPage", err);
    throw err;
  }

  const locale = await getLocaleSafe();
  redirect({ href: "/dashboard", locale });
}
