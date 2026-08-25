"use server";

import { db, withRetry } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidateWithLocale } from "@/lib/revalidate";
import type { AddressType } from "@prisma/client";

export interface AddressInput {
  customerId: string;
  label?: string;
  type: AddressType;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
}

export async function createAddress(input: AddressInput) {
  return withActionError("createAddress", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    if (input["isDefault"]) {
      await db["customerAddress"]["updateMany"]({
        where: { orgId, customerId: input["customerId"], type: input["type"] },
        data: { isDefault: false },
      });
    }

    const address = await db["customerAddress"]["create"]({
      data: {
        orgId,
        customerId: input["customerId"],
        label: input["label"],
        type: input["type"],
        line1: input["line1"],
        line2: input["line2"],
        city: input["city"],
        state: input["state"],
        postalCode: input["postalCode"],
        country: input["country"],
        isDefault: input["isDefault"] ?? false,
      },
      select: { id: true },
    });

    await revalidateWithLocale("/dashboard/customers");
    return address;
  });
}

export async function getCustomerAddresses(customerId: string) {
  return withActionError("getCustomerAddresses", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    const customer = await db["customer"]["findFirst"]({
      where: { id: customerId, orgId: user["organizationId"] },
      select: { id: true },
    });
    if (!customer) actionError("Customer not found.");

    const addresses = await db["customerAddress"]["findMany"]({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: { id: true, label: true, type: true, line1: true, line2: true, city: true, state: true, postalCode: true, country: true, isDefault: true },
    });

    return addresses;
  });
}

export async function getDefaultAddress(customerId: string, type: AddressType) {
  return withActionError("getDefaultAddress", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    const address = await db["customerAddress"]["findFirst"]({
      where: {
        customerId,
        type,
        isDefault: true,
        orgId: user["organizationId"],
      },
      select: { id: true, customerId: true, type: true },
    });

    return address;
  });
}

export async function updateAddress(id: string, input: Partial<AddressInput>) {
  return withActionError("updateAddress", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    const address = await db["customerAddress"]["findFirst"]({
      where: { id, orgId: user["organizationId"] },
      select: { id: true, customerId: true, type: true },
    });
    if (!address) actionError("Address not found.");

    if (input["isDefault"]) {
      await db["customerAddress"]["updateMany"]({
        where: {
          orgId: user["organizationId"],
          customerId: address["customerId"],
          type: address["type"],
        },
        data: { isDefault: false },
      });
    }

    const updated = await db["customerAddress"]["update"]({
      where: { id },
      data: {
        label: input["label"],
        line1: input["line1"],
        line2: input["line2"],
        city: input["city"],
        state: input["state"],
        postalCode: input["postalCode"],
        country: input["country"],
        isDefault: input["isDefault"] ?? false,
      },
      select: { id: true },
    });

    await revalidateWithLocale("/dashboard/customers");
    return updated;
  });
}

export async function deleteAddress(id: string) {
  return withActionError("deleteAddress", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    await db["customerAddress"]["deleteMany"]({ where: { id, orgId: user["organizationId"] } });
    await revalidateWithLocale("/dashboard/customers");
  });
}
