import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureVerified } from "@/lib/org";
import { getReminderConfig, saveReminderConfig, getReminders, type ReminderStageInput } from "@/lib/actions/invoices";
import { auditContextFromRequest, recordAudit } from "@/lib/audit";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  await ensureVerified();
  return session;
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const url = new URL(req["url"]);
    const invoiceId = url["searchParams"]["get"]("invoiceId");

    if (invoiceId) {
      const reminders = await getReminders({ invoiceId });
      return NextResponse["json"]({ reminders });
    }

    const config = await getReminderConfig();
    return NextResponse["json"](config);
  } catch (err: any) {
    if (err && err["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 403 });
    }
    if (err && err["message"] === "Unauthorized") {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    if (err && err["name"] === "ActionError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 400 });
    }
    logError("api:error", err);
    return NextResponse["json"]({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
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

    await recordAudit({
      category: "SETTINGS",
      action: "REMINDER_SETTINGS_CHANGED",
      orgId: session["user"]["organizationId"],
      actorId: session["user"]["id"],
      actorEmail: session["user"]["email"],
      actorRole: session["user"]["role"],
      targetType: "ReminderConfig",
      metadata: {
        enabled: body["enabled"] ?? true,
        frequencyHours: Number(body["frequencyHours"]) || 24,
        maxReminders: Number(body["maxReminders"]) || 5,
        stageCount: stages["length"],
      },
      ...auditContextFromRequest(req),
    });

    return NextResponse["json"](config);
  } catch (err: any) {
    if (err && err["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 403 });
    }
    if (err && err["message"] === "Unauthorized") {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    if (err && err["name"] === "ActionError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 400 });
    }
    logError("api:error", err);
    return NextResponse["json"]({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

