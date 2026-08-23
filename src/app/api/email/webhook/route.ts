import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logError, logInfo } from "@/lib/logging";
import { isMissingColumnError } from "@/lib/org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySignature(req: NextRequest, provider: string): boolean {
  if (provider !== "resend") return true;
  const secret = process["env"]["RESEND_WEBHOOK_SECRET"];
  if (!secret) return true;
  const signature = req["headers"]["get"]("x-resend-signature");
  if (!signature) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const provider = process["env"]["EMAIL_PROVIDER"] || "resend";
    if (!verifySignature(req, provider)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req["json"]();
    const eventType = body["type"] || body["event"];
    const data = body["data"] || {};
    const messageId = data?.["email_id"] || data?.["message_id"] || data?.["id"];

    if (!messageId) {
      logInfo("email-webhook", "No message ID in webhook payload, skipping.");
      return NextResponse["json"]({ success: true, message: "Skipped (no message ID)" });
    }

    let status: string | null = null;
    let deliveredAt: Date | null = null;
    let errorMessage: string | null = null;

    switch (eventType) {
      case "email.delivered":
        status = "DELIVERED";
        deliveredAt = new Date(data["timestamp"] || Date["now"]());
        break;
      case "email.bounced":
        status = "BOUNCED";
        errorMessage = data["bounce"]?.["reason"] || data["reason"] || "Bounced";
        break;
      case "email.complained":
        status = "BOUNCED";
        errorMessage = "Recipient complained (spam report)";
        break;
      default:
        logInfo("email-webhook", `Unhandled event type: ${eventType}`);
        return NextResponse["json"]({ success: true, message: "Event ignored" });
    }

    try {
      await db["reminder"]["updateMany"]({
        where: {
          metadata: {
            path: ["messageId"],
            equals: messageId,
          },
        },
        data: {
          status: status ?? undefined,
          deliveredAt: deliveredAt ?? undefined,
          errorMessage: errorMessage ?? undefined,
        },
      });
    } catch (err) {
      if (isMissingColumnError(err)) {
        logInfo("email-webhook", "metadata column not available, skipping status update");
      } else {
        throw err;
      }
    }

    return NextResponse["json"]({ success: true, status });
  } catch (err) {
    logError("email-webhook", err);
    return NextResponse["json"]({ error: "Webhook processing failed" }, { status: 500 });
  }
}
