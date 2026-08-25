"use server";

import { addDays } from "date-fns";
import { db, withRetry } from "@/lib/db";
import { requireUser, isInvalidEnumValueError } from "@/lib/org";
import { withActionError, actionError } from "@/lib/action-errors";
import { revalidateWithLocale } from "@/lib/revalidate";

export interface LateFeeConfigInput {
  enabled: boolean;
  rate: number;
  graceDays: number;
  fixedFee: number;
  maxFee?: number | null;
}

export async function saveLateFeeConfig(input: LateFeeConfigInput) {
  return withActionError("saveLateFeeConfig", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");
    const orgId = user["organizationId"];

    const config = await db["lateFeeConfig"]["upsert"]({
      where: { orgId },
      update: {
        enabled: input["enabled"],
        rate: input["rate"],
        graceDays: input["graceDays"],
        fixedFee: input["fixedFee"],
        maxFee: input["maxFee"],
      },
      create: {
        orgId,
        enabled: input["enabled"],
        rate: input["rate"],
        graceDays: input["graceDays"],
        fixedFee: input["fixedFee"],
        maxFee: input["maxFee"],
      },
      select: { id: true },
    });

    await revalidateWithLocale("/dashboard/settings/late-fees");
    return config;
  });
}

export async function getLateFeeConfig() {
  return withActionError("getLateFeeConfig", async () => {
    const user = await requireUser();
    if (!user["organizationId"]) actionError("No organization");

    const config = await db["lateFeeConfig"]["findUnique"]({
      where: { orgId: user["organizationId"] },
      select: { id: true, enabled: true, rate: true, graceDays: true, fixedFee: true, maxFee: true },
    });

    return config;
  });
}

export async function applyLateFees() {
  return withActionError("applyLateFees", async () => {
    const now = new Date();

    const orgs = await db["organization"]["findMany"]({
      include: { lateFeeConfig: true },
    });

    const results: { invoiceId: string; number: string; lateFee: number }[] = [];

    for (const org of orgs) {
      if (!org["lateFeeConfig"] || !org["lateFeeConfig"]["enabled"]) continue;
      const cfg = org["lateFeeConfig"];

      let invoices;
      try {
        invoices = await db["invoice"]["findMany"]({
          where: {
            orgId: org["id"],
            status: { in: ["UNPAID", "OVERDUE", "SENT", "VIEWED"] },
            dueDate: { lte: addDays(now, -cfg["graceDays"]) },
          },
          select: { id: true, number: true, total: true, amountPaid: true, status: true, lateFeeAmount: true },
        });
      } catch (err) {
        if (isInvalidEnumValueError(err)) {
          invoices = await db["invoice"]["findMany"]({
            where: {
              orgId: org["id"],
              status: { in: ["OVERDUE", "SENT", "VIEWED"] },
              dueDate: { lte: addDays(now, -cfg["graceDays"]) },
            },
            select: { id: true, number: true, total: true, amountPaid: true, status: true, lateFeeAmount: true },
          });
        } else {
          throw err;
        }
      }

      for (const invoice of invoices) {
        if (invoice["lateFeeAmount"] > 0) continue;

        const remaining = invoice["total"] - invoice["amountPaid"];
        if (remaining <= 0) continue;

        const percentageFee = (remaining * cfg["rate"]) / 100;
        let lateFee = percentageFee + cfg["fixedFee"];
        if (cfg["maxFee"] && lateFee > cfg["maxFee"]) lateFee = cfg["maxFee"];

        await db["invoice"]["update"]({
          where: { id: invoice["id"] },
          data: {
            lateFeeAmount: lateFee,
            total: invoice["total"] + lateFee,
            status: "OVERDUE",
          },
          select: { id: true },
        });

        await db["invoiceAudit"]["create"]({
          data: {
            invoiceId: invoice["id"],
            orgId: org["id"],
            action: "LATE_FEE_APPLIED",
            fromStatus: invoice["status"],
            toStatus: "OVERDUE",
            amount: lateFee,
            note: `Late fee of ${lateFee["toFixed"](2)} applied (${cfg["rate"]}% + ${cfg["fixedFee"]} fixed)`,
          },
          select: { id: true },
        });

        results["push"]({
          invoiceId: invoice["id"],
          number: invoice["number"],
          lateFee,
        });
      }
    }

    await revalidateWithLocale("/dashboard/invoices");
    await revalidateWithLocale("/dashboard/reports");
    return results;
  });
}
