import { requireUser, requireFeature } from "@/lib/org";
import { db } from "@/lib/db";
import { ExpenseForm } from "@/components/expense-form";
import { isR2Configured } from "@/lib/r2";

export default async function NewExpensePage() {
  await requireFeature("expenseTracking");
  const user = await requireUser();
  if (!user.organizationId) return null;
  const projects = await db.project.findMany({
    where: { orgId: user.organizationId },
    orderBy: { name: "asc" },
  });
  const r2 = isR2Configured();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New expense</h1>
      <ExpenseForm projects={projects} r2Enabled={r2} />
    </div>
  );
}
