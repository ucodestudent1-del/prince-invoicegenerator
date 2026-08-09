import { requireUser, requireFeature } from "@/lib/org";
import { SubcontractorForm } from "@/components/subcontractor-form";
import { getTranslations } from "next-intl/server";

export default async function NewSubcontractorPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations("subcontractors");
  await requireFeature("subcontractorTracking");
  await requireUser();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("newSubcontractor")}</h1>
      <SubcontractorForm />
    </div>
  );
}
