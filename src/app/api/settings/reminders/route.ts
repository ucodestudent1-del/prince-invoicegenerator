import { NextRequest, NextResponse } from "next/server";
import { getReminderConfig, saveReminderConfig } from "@/lib/actions/invoices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getReminderConfig();
    return NextResponse.json(config);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config = await saveReminderConfig({
      enabled: body.enabled ?? true,
      remindBeforeDue: Number(body.remindBeforeDue) || 3,
      remindAfterDue: Number(body.remindAfterDue) || 1,
      frequencyHours: Number(body.frequencyHours) || 24,
      maxReminders: Number(body.maxReminders) || 3,
      emailSubject: body.emailSubject,
      emailTemplate: body.emailTemplate,
    });
    return NextResponse.json(config);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
