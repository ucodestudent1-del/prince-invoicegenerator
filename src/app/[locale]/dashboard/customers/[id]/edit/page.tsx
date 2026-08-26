import { redirect } from "@/i18n/navigation";
import { requireUser, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { CustomerForm } from "@/components/customer-form";
import { logServerError } from "@/lib/errors";

export default async function EditCustomerPage({
  params,
}: {
  params: { id: string; locale: string };
}) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];

  let customer: any;
  try {
    customer = await db["customer"]["findFirst"]({
      where: { id: params["id"], orgId },
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        phone: true,
        address: true,
        notes: true,
      },
    });
  } catch (err) {
    if (isMissingColumnError(err)) {
      try {
        customer = await db["customer"]["findFirst"]({
          where: { id: params["id"], orgId },
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            phone: true,
            notes: true,
          },
        });
      } catch {
        customer = null;
      }
    } else {
      logServerError("EditCustomerPage", err);
      throw err;
    }
  }

  if (!customer) {
    redirect({ href: "/dashboard/customers", locale: params["locale"] });
    throw new Error("Unreachable: redirect should have exited");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit customer</h1>
      <CustomerForm
        customerId={customer["id"]}
        initialData={{
          name: customer["name"],
          company: customer["company"] ?? undefined,
          email: customer["email"] ?? undefined,
          phone: customer["phone"] ?? undefined,
          address: customer["address"] ?? undefined,
          notes: customer["notes"] ?? undefined,
        }}
      />
    </div>
  );
}
