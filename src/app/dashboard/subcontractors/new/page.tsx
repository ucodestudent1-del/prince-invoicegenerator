import { requireUser, requireFeature } from "@/lib/org";
import { SubcontractorForm } from "@/components/subcontractor-form";

export default async function NewSubcontractorPage() {
  await requireFeature("subcontractorTracking");
  await requireUser();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New subcontractor</h1>
      <SubcontractorForm />
    </div>
  );
}
