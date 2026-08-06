import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logError } from "@/lib/logging";
import { isInvalidEnumValueError } from "@/lib/org";
import { isBackgroundJobAuthorized } from "@/lib/background-job-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isBackgroundJobAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const now = new Date();
    const results: any[] = [];

    const configs = await db.reminderConfig.findMany({
      where: { enabled: true },
      include: {
        org: {
          select: { id: true, name: true },
        },
      },
    });

    for (const config of configs) {
      const orgId = config.orgId;

      let invoices;
      try {
        invoices = await db.invoice.findMany({
          where: {
            orgId,
            status: { in: ["SENT", "UNPAID", "OVERDUE", "VIEWED"] },
          },
          include: { customer: { select: { name: true, email: true } } },
        });
      } catch (err) {
        if (isInvalidEnumValueError(err)) {
          invoices = await db.invoice.findMany({
            where: {
              orgId,
              status: { in: ["SENT", "OVERDUE", "VIEWED"] },
            },
            include: { customer: { select: { name: true, email: true } } },
          });
        } else {
          throw err;
        }
      }

      for (const invoice of invoices) {
        if (!invoice.dueDate) continue;

        const dueDate = new Date(invoice.dueDate);
        const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        let shouldRemind = false;
        let reminderType = "";

        if (daysDiff >= 0 && daysDiff <= config.remindAfterDue) {
          shouldRemind = true;
          reminderType = "OVERDUE";
        } else if (daysDiff < 0 && Math.abs(daysDiff) <= config.remindBeforeDue) {
          shouldRemind = true;
          reminderType = "DUE_DATE";
        }

        if (!shouldRemind) continue;

        const recentReminders = await db.reminder.count({
          where: {
            invoiceId: invoice.id,
            status: "SENT",
            createdAt: {
              gte: new Date(now.getTime() - config.frequencyHours * 60 * 60 * 1000),
            },
          },
        });

        if (recentReminders >= config.maxReminders) continue;

        await db.reminder.create({
          data: {
            orgId,
            invoiceId: invoice.id,
            type: reminderType,
            scheduledAt: now,
            status: "SENT",
            channel: "EMAIL",
            note: `Automated reminder sent for invoice ${invoice.number}`,
          },
        });

        await db.invoiceAudit.create({
          data: {
            invoiceId: invoice.id,
            orgId,
            action: "REMINDER_SENT",
            toStatus: invoice.status,
            note: `Automated ${reminderType} reminder sent`,
          },
        });

        results.push({
          org: config.org.name,
          invoice: invoice.number,
          type: reminderType,
        });
      }
    }

    return NextResponse.json({ success: true, remindersSent: results.length, details: results });
  } catch (err) {
    logError("reminders-check", err);
    return NextResponse.json({ error: "Failed to process reminders." }, { status: 500 });
  }
}
