"use server";

import { addDays } from "date-fns";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { isInvalidEnumValueError, isMissingColumnError } from "@/lib/db-drift";
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

    let orgs;
    try {
      orgs = await db["organization"]["findMany"]({
        where: { lateFeeConfig: { isNot: null } },
        select: {
          id: true,
          lateFeeConfig: {
            select: {
              id: true,
              enabled: true,
              rate: true,
              graceDays: true,
              fixedFee: true,
              maxFee: true,
            },
          },
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        return [];
      }
      throw err;
    }

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
        } else if (isMissingColumnError(err)) {
          invoices = await db["invoice"]["findMany"]({
            where: {
              orgId: org["id"],
              status: { in: ["UNPAID", "OVERDUE", "SENT", "VIEWED"] },
              dueDate: { lte: addDays(now, -cfg["graceDays"]) },
            },
            select: { id: true, number: true, total: true, amountPaid: true, status: true },
          });
        } else {
          throw err;
        }
      }

      for (const invoice of invoices) {
        if ((invoice as any)["lateFeeAmount"] > 0) continue;

        const remaining = invoice["total"] - invoice["amountPaid"];
        if (remaining <= 0) continue;

        const percentageFee = (remaining * cfg["rate"]) / 100;
        let lateFee = percentageFee + cfg["fixedFee"];
        if (cfg["maxFee"] && lateFee > cfg["maxFee"]) lateFee = cfg["maxFee"];

        // Invariant: a paid invoice must never end up with a positive
        // balance after a late fee. Two scenarios are possible:
        //   1. amountPaid < total: the invoice was unpaid when the cron
        //      ran, so the fee adds to `total` and the existing
        //      `amountPaid` is left alone.
        //   2. amountPaid >= total: the invoice was already paid when
        //      this fee posts (e.g. a customer paid a moment ago). In
        //      that case bump `amountPaid` to the new `total` so the
        //      status remains PAID, and audit a separate note flagging
        //      the unusual post-hoc fee.
        const wasPaid = invoice["amountPaid"] >= invoice["total"];
        const newTotal = invoice["total"] + lateFee;
        const newAmountPaid = wasPaid ? newTotal : invoice["amountPaid"];
        const newStatus: "OVERDUE" | "PAID" = wasPaid ? "PAID" : "OVERDUE";

        try {
          await db["invoice"]["update"]({
            where: { id: invoice["id"], orgId: org["id"] },
            data: {
              lateFeeAmount: lateFee,
              total: newTotal,
              amountPaid: newAmountPaid,
              status: newStatus,
            },
            select: { id: true },
          });
        } catch (err) {
          if (isMissingColumnError(err)) {
            // Schema drift: the `lateFeeAmount` or `amountPaid` column
            // doesn't exist yet. Best-effort: just update total + status.
            await db["invoice"]["update"]({
              where: { id: invoice["id"], orgId: org["id"] },
              data: {
                total: newTotal,
                status: newStatus,
              },
              select: { id: true },
            });
          } else {
            throw err;
          }
        }

        await db["invoiceAudit"]["create"]({
          data: {
            invoiceId: invoice["id"],
            orgId: org["id"],
            action: "LATE_FEE_APPLIED",
            fromStatus: invoice["status"],
            toStatus: newStatus,
            amount: lateFee,
            note: wasPaid
              ? `Late fee of ${lateFee["toFixed"](2)} posted to an invoice that was already paid (${cfg["rate"]}% + ${cfg["fixedFee"]} fixed)`
              : `Late fee of ${lateFee["toFixed"](2)} applied (${cfg["rate"]}% + ${cfg["fixedFee"]} fixed)`,
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
