"use server";

import { requireUser } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";

export async function updateUserLocale(locale: string) {
  return withActionError("updateUserLocale", async () => {
    const user = await requireUser();

    if (!routing.locales.includes(locale as any)) {
      actionError("Invalid locale.");
    }

    await db.user.update({
      where: { id: user.id },
      data: { locale },
    });
  });
}
