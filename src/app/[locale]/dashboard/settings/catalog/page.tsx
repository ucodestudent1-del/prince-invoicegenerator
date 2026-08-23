import { requireUser, requireFeature, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";
import { CatalogManagementView } from "@/components/catalog-management-view";

export default async function CatalogPage({ params }: { params: { locale: string } }) {
  await requireFeature("catalogItems");
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];

  let initialItems: any[] = [];
  try {
    initialItems = await db["catalogItem"]["findMany"]({
      where: { orgId },
      orderBy: [
        { isFavorite: "desc" },
        { sortOrder: "asc" },
        { updatedAt: "desc" },
      ],
    });
  } catch (err) {
    if (isMissingColumnError(err)) {
      initialItems = [];
    } else {
      logServerError("CatalogPage", err);
      throw err;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Products & Services</h1>
        <p className="text-sm text-muted-foreground">
          Save frequently used items to speed up invoice creation.
        </p>
      </div>
      <CatalogManagementView initialItems={initialItems} />
    </div>
  );
}
