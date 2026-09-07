"use server";

import { db } from "@/lib/db";
import { requireUser, isMissingColumnError } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidateWithLocale } from "@/lib/revalidate";
import { authorize } from "@/lib/authorization";

async function requireSettingsPermission() {
  const user = await requireUser();
  if (!user["organizationId"]) actionError("No organization");
  const decision = await authorize({
    userId: user["id"],
    orgId: user["organizationId"]!,
    permission: "settings.edit",
  });
  if (!decision["allowed"]) actionError("You do not have permission to modify settings.");
  return user;
}

export async function saveThemeSettings(theme: string) {
  return withActionError("saveThemeSettings", async () => {
    const user = await requireSettingsPermission();
    const orgId = user["organizationId"]!;

    try {
      await db["organization"]["update"]({
        where: { id: orgId },
        data: { theme },
      });
    } catch (err: any) {
      if (isMissingColumnError(err)) {
        const { cookies } = await import("next/headers");
        cookies()["set"]("theme", theme, {
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
    if (!user["organizationId"]) actionError("No organization");

    try {
      const org = await db["organization"]["findUnique"]({
        where: { id: user["organizationId"] },
        select: { theme: true },
      });

      return org?.["theme"] ?? "light";
    } catch (err: any) {
      if (isMissingColumnError(err)) {
        const { cookies } = await import("next/headers");
        const cookieTheme = cookies()["get"]("theme")?.["value"];
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
    const user = await requireSettingsPermission();
    const orgId = user["organizationId"]!;

    try {
      await db["organization"]["update"]({
        where: { id: orgId },
        data: {
          brandColor: input["brandColor"],
          accentColor: input["accentColor"],
        },
      });

      await revalidateWithLocale("/dashboard/invoices");
      await revalidateWithLocale("/dashboard");
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
    }
  });
}

export async function getBrandColors() {
  return withActionError("getBrandColors", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    try {
      const org = await db["organization"]["findUnique"]({
        where: { id: user["organizationId"] },
        select: { brandColor: true, accentColor: true },
      });

      return {
        brandColor: org?.["brandColor"] ?? "#ea5804",
        accentColor: org?.["accentColor"] ?? "#ea5804",
      };
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
      return { brandColor: "#ea5804", accentColor: "#ea5804" };
    }
  });
}

export async function saveFontSettings(fontFamily: string) {
  return withActionError("saveFontSettings", async () => {
    const user = await requireSettingsPermission();
    const orgId = user["organizationId"]!;

    try {
      await db["organization"]["update"]({
        where: { id: orgId },
        data: { fontFamily: fontFamily || null },
      });

      await revalidateWithLocale("/dashboard/invoices");
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
    }
  });
}

export async function getFontSettings() {
  return withActionError("getFontSettings", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    try {
      const org = await db["organization"]["findUnique"]({
        where: { id: user["organizationId"] },
        select: { fontFamily: true },
      });

      return org?.["fontFamily"] ?? "";
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
      return "";
    }
  });
}

export async function saveLayoutSettings(layout: string) {
  return withActionError("saveLayoutSettings", async () => {
    const user = await requireSettingsPermission();
    const orgId = user["organizationId"]!;

    try {
      await db["organization"]["update"]({
        where: { id: orgId },
        data: { layout },
      });

      await revalidateWithLocale("/dashboard/invoices");
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
    }
  });
}

export async function getLayoutSettings() {
  return withActionError("getLayoutSettings", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    try {
      const org = await db["organization"]["findUnique"]({
        where: { id: user["organizationId"] },
        select: { layout: true },
      });

      return org?.["layout"] ?? "default";
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
      return "default";
    }
  });
}
