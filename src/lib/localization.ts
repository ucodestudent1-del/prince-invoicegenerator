import { db } from "@/lib/db";
import { routing } from "@/i18n/routing";

export type EntityType =
  | "Customer"
  | "Project"
  | "Invoice"
  | "Estimate"
  | "ChangeOrder"
  | "Expense"
  | "Subcontractor";

export async function setLocalizedString(
  orgId: string,
  entityType: EntityType,
  entityId: string,
  field: string,
  locale: string,
  value: string
) {
  if (!routing["locales"]["includes"](locale as any)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }
  return db["localizedString"]["upsert"]({
    where: {
      orgId_entityType_entityId_field_locale: {
        orgId,
        entityType,
        entityId,
        field,
        locale,
      },
    },
    update: { value },
    create: {
      orgId,
      entityType,
      entityId,
      field,
      locale,
      value,
    },
  });
}

export async function getLocalizedString(
  orgId: string,
  entityType: EntityType,
  entityId: string,
  field: string,
  locale: string,
  fallbackToBase?: (field: string) => string | null
): Promise<string | null> {
  const record = await db["localizedString"]["findUnique"]({
    where: {
      orgId_entityType_entityId_field_locale: {
        orgId,
        entityType,
        entityId,
        field,
        locale,
      },
    },
  });

  if (record?.["value"]) return record["value"];

  if (fallbackToBase) {
    const base = fallbackToBase(field);
    if (base) return base;
  }

  if (locale !== routing["defaultLocale"]) {
    const fallback = await db["localizedString"]["findUnique"]({
      where: {
        orgId_entityType_entityId_field_locale: {
          orgId,
          entityType,
          entityId,
          field,
          locale: routing["defaultLocale"],
        },
      },
    });
    if (fallback?.["value"]) return fallback["value"];
  }

  return null;
}

export async function getLocalizedStrings(
  orgId: string,
  entityType: EntityType,
  entityId: string,
  field: string,
  locales: string[]
): Promise<Record<string, string | null>> {
  const records = await db["localizedString"]["findMany"]({
    where: {
      orgId,
      entityType,
      entityId,
      field,
      locale: { in: locales },
    },
  });

  const result: Record<string, string | null> = {};
  for (const loc of locales) {
    result[loc] = records["find"]((r) => r["locale"] === loc)?.["value"] ?? null;
  }
  return result;
}

export async function deleteLocalizedString(
  orgId: string,
  entityType: EntityType,
  entityId: string,
  field: string,
  locale: string
) {
  await db["localizedString"]["deleteMany"]({
    where: {
      orgId,
      entityType,
      entityId,
      field,
      locale,
    },
  });
}
