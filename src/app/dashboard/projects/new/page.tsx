import { requireUser, requireFeature } from "@/lib/org";
import { ProjectForm } from "@/components/project-form";

export default async function NewProjectPage() {
  await requireFeature("projectManagement");
  const user = await requireUser();
  if (!user.organizationId) return null;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New project</h1>
      <ProjectForm />
    </div>
  );
}
