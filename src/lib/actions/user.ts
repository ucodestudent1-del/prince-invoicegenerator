"use server";

import { requireUser } from "@/lib/org";
import { isMissingColumnError } from "@/lib/db-drift";
import { withActionError, actionError } from "@/lib/action-errors";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";

export async function updateUserLocale(locale: string) {
  return withActionError("updateUserLocale", async () => {
    const user = await requireUser();

    if (!routing["locales"]["includes"](locale as any)) {
      actionError("Invalid locale.");
    }

    try {
      await db["user"]["update"]({
        where: { id: user["id"] },
        data: { locale },
        select: { id: true },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        // locale column doesn't exist — schema drift, migration not applied
      } else {
        throw err;
      }
    }
  });
}
