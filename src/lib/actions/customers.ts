"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidateWithLocale } from "@/lib/revalidate";

export interface CustomerInput {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export async function createCustomer(input: CustomerInput) {
  return withActionError("createCustomer", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    if (!input["name"]) actionError("Customer name is required.");

    const customer = await db["customer"]["create"]({
      data: { orgId: user["organizationId"], ...input },
    });
    await revalidateWithLocale("/dashboard/customers");
    return customer;
  });
}

export async function deleteCustomer(id: string) {
  return withActionError("deleteCustomer", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    await db["customer"]["deleteMany"]({ where: { id, orgId: user["organizationId"] } });
    await revalidateWithLocale("/dashboard/customers");
  });
}
