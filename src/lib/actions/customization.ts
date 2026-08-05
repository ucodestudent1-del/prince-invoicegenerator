"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import type { TemplateStyle } from "@prisma/client";

export async function saveTemplateSettings(template: TemplateStyle) {
  return withActionError("saveTemplateSettings", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    await db.organization.update({
      where: { id: user.organizationId },
      data: { template },
    });

    revalidatePath("/dashboard/settings/templates");
    revalidatePath("/dashboard/invoices");
  });
}

export async function getTemplateSettings() {
  return withActionError("getTemplateSettings", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    const org = await db.organization.findUnique({
      where: { id: user.organizationId },
      select: { template: true },
    });

    return org?.template ?? "STANDARD";
  });
}

export async function saveThemeSettings(theme: string) {
  return withActionError("saveThemeSettings", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    await db.organization.update({
      where: { id: user.organizationId },
      data: { theme },
    });

    revalidatePath("/dashboard");
  });
}

export async function getThemeSettings() {
  return withActionError("getThemeSettings", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    const org = await db.organization.findUnique({
      where: { id: user.organizationId },
      select: { theme: true },
    });

    return org?.theme ?? "light";
  });
}

export async function saveBrandColors(input: {
  brandColor?: string | null;
  accentColor?: string | null;
}) {
  return withActionError("saveBrandColors", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    await db.organization.update({
      where: { id: user.organizationId },
      data: {
        brandColor: input.brandColor,
        accentColor: input.accentColor,
      },
    });

    revalidatePath("/dashboard/settings/customization");
    revalidatePath("/dashboard/invoices");
  });
}

export async function getBrandColors() {
  return withActionError("getBrandColors", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    const org = await db.organization.findUnique({
      where: { id: user.organizationId },
      select: { brandColor: true, accentColor: true },
    });

    return {
      brandColor: org?.brandColor ?? "#ea5804",
      accentColor: org?.accentColor ?? "#ea5804",
    };
  });
}

export async function saveFontSettings(fontFamily: string) {
  return withActionError("saveFontSettings", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    await db.organization.update({
      where: { id: user.organizationId },
      data: { fontFamily: fontFamily || null },
    });

    revalidatePath("/dashboard/settings/customization");
  });
}

export async function getFontSettings() {
  return withActionError("getFontSettings", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    const org = await db.organization.findUnique({
      where: { id: user.organizationId },
      select: { fontFamily: true },
    });

    return org?.fontFamily ?? "";
  });
}

export async function saveLayoutSettings(layout: string) {
  return withActionError("saveLayoutSettings", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    await db.organization.update({
      where: { id: user.organizationId },
      data: { layout },
    });

    revalidatePath("/dashboard/invoices");
  });
}

export async function getLayoutSettings() {
  return withActionError("getLayoutSettings", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    const org = await db.organization.findUnique({
      where: { id: user.organizationId },
      select: { layout: true },
    });

    return org?.layout ?? "default";
  });
}
