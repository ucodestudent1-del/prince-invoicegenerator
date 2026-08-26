"use server";

import { db } from "@/lib/db";
import { requireUser, isMissingColumnError } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidateWithLocale } from "@/lib/revalidate";
import type { CatalogUnit } from "@prisma/client";

export interface CreateCatalogItemInput {
  name: string;
  description?: string | null;
  price: number;
  unit: CatalogUnit;
  taxRate: number;
  taxCategory?: string | null;
  sku?: string | null;
  discount: number;
}

export async function createCatalogItem(input: CreateCatalogItemInput) {
  return withActionError("createCatalogItem", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    if (!input["name"] || input["name"]["trim"]() === "") {
      actionError("Item name is required.");
    }
    if (input["price"] < 0) {
      actionError("Price cannot be negative.");
    }
    if (input["taxRate"] < 0) {
      actionError("Tax rate cannot be negative.");
    }
    if (input["discount"] < 0 || input["discount"] > 100) {
      actionError("Discount must be between 0 and 100.");
    }

    if (input["sku"]) {
      let skuExists = false;
      try {
        const existing = await db["catalogItem"]["findFirst"]({
          where: { orgId, sku: input["sku"] },
          select: { id: true },
        });
        if (existing) skuExists = true;
      } catch (err) {
        if (!isMissingColumnError(err)) throw err;
      }
      if (skuExists) {
        actionError(`SKU '${input["sku"]}' is already in use by another item.`);
      }
    }

    let item;
    try {
      item = await db["catalogItem"]["create"]({
        data: {
          orgId,
          name: input["name"],
          description: input["description"] || null,
          price: input["price"],
          unit: input["unit"],
          taxRate: input["taxRate"],
          taxCategory: input["taxCategory"] || null,
          sku: input["sku"] || null,
          discount: input["discount"],
        },
      });
    } catch (err) {
      if (err instanceof Error && err["message"]["includes"]("Unique constraint failed")) {
        actionError(`SKU '${input["sku"]}' is already in use by another item.`);
      }
      if (isMissingColumnError(err)) {
        item = await db["catalogItem"]["create"]({
          data: {
            orgId,
            name: input["name"],
            description: input["description"] || null,
            price: input["price"],
            unit: input["unit"],
            taxRate: input["taxRate"],
            discount: input["discount"],
          },
        });
      } else {
        throw err;
      }
    }

    await revalidateWithLocale("/dashboard/settings/catalog");
    return item;
  });
}

export async function updateCatalogItem(id: string, input: Partial<CreateCatalogItemInput> & { isFavorite?: boolean }) {
  return withActionError("updateCatalogItem", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const existing = await db["catalogItem"]["findFirst"]({
      where: { id, orgId },
      select: { id: true },
    });
    if (!existing) actionError("Catalog item not found");

    if (input["sku"]) {
      const currentItem = await db["catalogItem"]["findFirst"]({ where: { id, orgId }, select: { sku: true } });
      if (input["sku"] !== currentItem?.["sku"]) {
        let skuExists = false;
        try {
          const dup = await db["catalogItem"]["findFirst"]({
            where: { orgId, sku: input["sku"], NOT: { id } },
            select: { id: true },
          });
          if (dup) skuExists = true;
        } catch (err) {
          if (!isMissingColumnError(err)) throw err;
        }
        if (skuExists) {
          actionError(`SKU '${input["sku"]}' is already in use by another item.`);
        }
      }
    }

    let item;
    try {
      item = await db["catalogItem"]["update"]({
        where: { id, orgId },
        data: {
          name: input["name"],
          description: input["description"],
          price: input["price"],
          unit: input["unit"],
          taxRate: input["taxRate"],
          taxCategory: input["taxCategory"],
          sku: input["sku"],
          discount: input["discount"],
          isFavorite: input["isFavorite"],
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        const updateData: Record<string, any> = {};
        if (input["name"] !== undefined) updateData["name"] = input["name"];
        if (input["description"] !== undefined) updateData["description"] = input["description"];
        if (input["price"] !== undefined) updateData["price"] = input["price"];
        if (input["unit"] !== undefined) updateData["unit"] = input["unit"];
        if (input["taxRate"] !== undefined) updateData["taxRate"] = input["taxRate"];
        if (input["sku"] !== undefined) updateData["sku"] = input["sku"];
        if (input["discount"] !== undefined) updateData["discount"] = input["discount"];
        if (input["taxCategory"] !== undefined) updateData["taxCategory"] = input["taxCategory"];

        item = await db["catalogItem"]["update"]({
          where: { id, orgId },
          data: updateData,
        });
      } else {
        throw err;
      }
    }

    await revalidateWithLocale("/dashboard/settings/catalog");
    return item;
  });
}

export async function deleteCatalogItem(id: string) {
  return withActionError("deleteCatalogItem", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const existing = await db["catalogItem"]["findFirst"]({
      where: { id, orgId },
      select: { id: true },
    });
    if (!existing) actionError("Catalog item not found");

    await db["catalogItem"]["delete"]({ where: { id, orgId } });

    await revalidateWithLocale("/dashboard/settings/catalog");
    return { success: true, id };
  });
}

export async function getCatalogItems(params?: {
  search?: string;
  unit?: string;
  limit?: number;
  favoritesOnly?: boolean;
}) {
  return withActionError("getCatalogItems", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const where: Record<string, any> = { orgId };
    if (params?.["search"]) {
      where["OR"] = [
        { name: { contains: params["search"], mode: "insensitive" } },
        { description: { contains: params["search"], mode: "insensitive" } },
        { sku: { contains: params["search"], mode: "insensitive" } },
      ];
    }
    if (params?.["unit"]) {
      where["unit"] = params["unit"];
    }
    if (params?.["favoritesOnly"]) {
      where["isFavorite"] = true;
    }

    try {
      const items = await db["catalogItem"]["findMany"]({
        where,
        orderBy: [
          { isFavorite: "desc" },
          { sortOrder: "asc" },
          { updatedAt: "desc" },
        ],
        take: params?.["limit"] ?? undefined,
      });
      return items;
    } catch (err) {
      if (isMissingColumnError(err)) {
        const fallbackWhere: Record<string, any> = { orgId };
        if (params?.["search"]) {
          fallbackWhere["OR"] = [
            { name: { contains: params["search"], mode: "insensitive" } },
          ];
        }
        if (params?.["unit"]) {
          fallbackWhere["unit"] = params["unit"];
        }
        return await db["catalogItem"]["findMany"]({
          where: fallbackWhere,
          orderBy: { updatedAt: "desc" },
          take: params?.["limit"] ?? undefined,
        });
      }
      throw err;
    }
  });
}

export async function getCatalogItem(id: string) {
  return withActionError("getCatalogItem", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const item = await db["catalogItem"]["findFirst"]({
      where: { id, orgId },
    });
    if (!item) actionError("Catalog item not found");
    return item;
  });
}

export async function duplicateCatalogItem(id: string) {
  return withActionError("duplicateCatalogItem", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const source = await db["catalogItem"]["findFirst"]({
      where: { id, orgId },
    });
    if (!source) actionError("Catalog item not found");

    const newItem = await db["catalogItem"]["create"]({
      data: {
        orgId,
        name: `${source["name"]} (copy)`,
        description: source["description"],
        price: source["price"],
        unit: source["unit"],
        taxRate: source["taxRate"],
        taxCategory: source["taxCategory"],
        sku: source["sku"] ? `${source["sku"]}-COPY` : null,
        discount: source["discount"],
      },
    });

    await revalidateWithLocale("/dashboard/settings/catalog");
    return newItem;
  });
}

export async function toggleCatalogItemFavorite(id: string, isFavorite: boolean) {
  return withActionError("toggleCatalogItemFavorite", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    try {
      const item = await db["catalogItem"]["update"]({
        where: { id, orgId },
        data: { isFavorite },
      });
      await revalidateWithLocale("/dashboard/settings/catalog");
      return item;
    } catch (err) {
      if (isMissingColumnError(err)) {
        actionError("Catalog items feature requires a database migration");
      }
      throw err;
    }
  });
}
