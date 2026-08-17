"use server";

import { db } from "@/lib/db";
import { requireUser, isMissingColumnError } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidateWithLocale } from "@/lib/revalidate";
import type { TemplateStyle } from "@prisma/client";

export async function saveTemplateSettings(template: TemplateStyle) {
  return withActionError("saveTemplateSettings", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    await db.organization.update({
      where: { id: user.organizationId },
      data: { template },
    });

    await revalidateWithLocale("/dashboard/settings/templates");
    await revalidateWithLocale("/dashboard/invoices");
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

    return org?.template ?? "REGULAR_INVOICE";
  });
}

export async function saveThemeSettings(theme: string) {
  return withActionError("saveThemeSettings", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    try {
      await db.organization.update({
        where: { id: user.organizationId },
        data: { theme },
      });
    } catch (err: any) {
      if (isMissingColumnError(err)) {
        // Column doesn't exist — write a cookie so the preference persists.
        // The client reads it on reload and passes it back as initialTheme.
        // Once the migration is applied, the DB column takes over.
        const { cookies } = await import("next/headers");
        cookies().set("theme", theme, {
          maxAge: 60 * 60 * 24 * 365,
          path: "/",
        });
      } else {
        throw err;
      }
    }

    await revalidateWithLocale("/dashboard");
  });
}

export async function getThemeSettings() {
  return withActionError("getThemeSettings", async () => {
    const user = await requireUser();
    if (!user.organizationId) actionError("No organization");

    try {
      const org = await db.organization.findUnique({
        where: { id: user.organizationId },
        select: { theme: true },
      });

      return org?.theme ?? "light";
    } catch (err: any) {
      if (isMissingColumnError(err)) {
        const { cookies } = await import("next/headers");
        const cookieTheme = cookies().get("theme")?.value;
        if (cookieTheme === "dark" || cookieTheme === "light") {
          return cookieTheme;
        }
        return "light";
      } else {
        throw err;
      }
    }
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

    await revalidateWithLocale("/dashboard/settings/customization");
    await revalidateWithLocale("/dashboard/invoices");
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

    await revalidateWithLocale("/dashboard/settings/customization");
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

    await revalidateWithLocale("/dashboard/invoices");
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
