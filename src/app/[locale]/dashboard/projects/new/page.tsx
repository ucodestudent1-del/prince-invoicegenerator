import { requireUser, requireFeature } from "@/lib/org";
import { db } from "@/lib/db";
import { logServerError } from "@/lib/errors";
import { ProjectForm } from "@/components/project-form";
import { getTranslations } from "next-intl/server";

export default async function NewProjectPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("projects");
  await requireFeature("projectManagement");
  const user = await requireUser();
  if (!user.organizationId) return null;

  let customers;
  try {
    customers = await db.customer.findMany({
      where: { orgId: user.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  } catch (err) {
    logServerError("NewProjectPage", err);
    throw err;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("newProject")}</h1>
      <ProjectForm customers={customers} />
    </div>
  );
}
