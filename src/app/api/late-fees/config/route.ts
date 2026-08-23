import { NextRequest, NextResponse } from "next/server";
import { getLateFeeConfig, saveLateFeeConfig } from "@/lib/actions/late-fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getLateFeeConfig();
    return NextResponse["json"](config);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req["json"]();
    const config = await saveLateFeeConfig({
      enabled: body["enabled"] ?? false,
      rate: Number(body["rate"]) || 0,
      graceDays: Number(body["graceDays"]) || 0,
      fixedFee: Number(body["fixedFee"]) || 0,
      maxFee: body["maxFee"] ? Number(body["maxFee"]) : null,
    });
    return NextResponse["json"](config);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}
