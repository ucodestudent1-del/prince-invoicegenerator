"use server";

import { db } from "@/lib/db";
import { logServerError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import type { InvoiceTemplateConfig } from "@/lib/invoice-template-config";
import { getDefaultTemplate } from "@/lib/invoice-template-config";

export async function getTemplates(orgId: string) {
  try {
    const templates = await db.invoiceTemplate.findMany({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        invoiceType: true,
        isDefault: true,
        isSystem: true,
        createdAt: true,
        updatedAt: true,
        configuration: true,
      },
    });
    return templates;
  } catch (err) {
    logServerError("getTemplates", err);
    return [];
  }
}

export async function getTemplate(id: string, orgId: string) {
  try {
    const template = await db.invoiceTemplate.findFirst({
      where: { id, orgId },
    });
    if (!template) return null;
    return template;
  } catch (err) {
    logServerError("getTemplate", err);
    return null;
  }
}

export async function createTemplate(
  orgId: string,
  userId: string,
  name: string,
  invoiceType: string,
  config: InvoiceTemplateConfig
) {
  try {
    const template = await db.invoiceTemplate.create({
      data: {
        name,
        invoiceType: invoiceType as any,
        orgId,
        userId,
        configuration: config as any,
        isDefault: false,
      },
    });
    revalidatePath("/dashboard/settings/invoice-templates");
    return template;
  } catch (err) {
    logServerError("createTemplate", err);
    throw new Error("Failed to create template");
  }
}

export async function updateTemplate(
  id: string,
  orgId: string,
  updates: {
    name?: string;
    invoiceType?: string;
    config?: InvoiceTemplateConfig;
    isDefault?: boolean;
  }
) {
  try {
    const template = await db.invoiceTemplate.update({
      where: { id, orgId },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.invoiceType && { invoiceType: updates.invoiceType as any }),
        ...(updates.config && { configuration: updates.config as any }),
        ...(updates.isDefault !== undefined && { isDefault: updates.isDefault }),
      },
    });
    revalidatePath("/dashboard/settings/invoice-templates");
    return template;
  } catch (err) {
    logServerError("updateTemplate", err);
    throw new Error("Failed to update template");
  }
}

export async function deleteTemplate(id: string, orgId: string) {
  try {
    await db.invoiceTemplate.delete({
      where: { id, orgId },
    });
    revalidatePath("/dashboard/settings/invoice-templates");
    return true;
  } catch (err) {
    logServerError("deleteTemplate", err);
    return false;
  }
}

export async function setDefaultTemplate(id: string, orgId: string) {
  try {
    await db.$transaction(async (tx) => {
      await tx.invoiceTemplate.updateMany({
        where: { orgId, isDefault: true },
        data: { isDefault: false },
      });
      await tx.invoiceTemplate.update({
        where: { id, orgId },
        data: { isDefault: true },
      });
    });
    revalidatePath("/dashboard/settings/invoice-templates");
    return true;
  } catch (err) {
    logServerError("setDefaultTemplate", err);
    return false;
  }
}

export async function getTemplateForInvoice(orgId: string, invoiceType: string) {
  try {
    const template = await db.invoiceTemplate.findFirst({
      where: { orgId, invoiceType: invoiceType as any, isDefault: true },
      orderBy: { updatedAt: "desc" },
      take: 1,
    });

    if (template) {
      return template;
    }

    return {
      id: "default",
      name: `Default ${invoiceType} Template`,
      invoiceType: invoiceType,
      config: getDefaultTemplate(invoiceType as any),
      isDefault: true,
    };
  } catch (err) {
    logServerError("getTemplateForInvoice", err);
    return {
      id: "default",
      name: `Default ${invoiceType} Template`,
      invoiceType: invoiceType,
      config: getDefaultTemplate(invoiceType as any),
      isDefault: true,
    };
  }
}
