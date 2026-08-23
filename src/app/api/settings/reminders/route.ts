import { NextRequest, NextResponse } from "next/server";
import { getReminderConfig, saveReminderConfig, getReminders, type ReminderStageInput } from "@/lib/actions/invoices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req["url"]);
    const invoiceId = url["searchParams"]["get"]("invoiceId");

    if (invoiceId) {
      const reminders = await getReminders({ invoiceId });
      return NextResponse["json"]({ reminders });
    }

    const config = await getReminderConfig();
    return NextResponse["json"](config);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req["json"]();

    const stages: ReminderStageInput[] = (body["stages"] || [])["map"]((s: any) => ({
      id: s["id"],
      name: s["name"],
      type: s["type"],
      enabled: s["enabled"] ?? true,
      daysOffset: Number(s["daysOffset"]) ?? 0,
      timeOfDay: s["timeOfDay"] ?? null,
      subjectTemplate: s["subjectTemplate"],
      bodyTemplate: s["bodyTemplate"],
      channel: s["channel"] ?? "EMAIL",
    }));

    const config = await saveReminderConfig({
      enabled: body["enabled"] ?? true,
      remindBeforeDue: body["remindBeforeDue"] != null ? Number(body["remindBeforeDue"]) : 7,
      remindAfterDue: body["remindAfterDue"] != null ? Number(body["remindAfterDue"]) : 1,
      frequencyHours: Number(body["frequencyHours"]) || 24,
      maxReminders: Number(body["maxReminders"]) || 5,
      emailSubject: body["emailSubject"],
      emailTemplate: body["emailTemplate"],
      stages,
    });

    return NextResponse["json"](config);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}
