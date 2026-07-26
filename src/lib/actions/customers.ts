"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";

export interface CustomerInput {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export async function createCustomer(input: CustomerInput) {
  const user = await requireUser();
  if (!user.organizationId) throw new Error("No organization");
  const customer = await db.customer.create({
    data: { orgId: user.organizationId, ...input },
  });
  revalidatePath("/dashboard/customers");
  return customer;
}

export async function deleteCustomer(id: string) {
  const user = await requireUser();
  if (!user.organizationId) throw new Error("No organization");
  await db.customer.deleteMany({ where: { id, orgId: user.organizationId } });
  revalidatePath("/dashboard/customers");
}
