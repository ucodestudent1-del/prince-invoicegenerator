import { NextRequest, NextResponse } from "next/server";
import {
  saveTemplateSettings,
  getTemplateSettings,
  saveThemeSettings,
  getThemeSettings,
  saveBrandColors,
  getBrandColors,
  saveFontSettings,
  getFontSettings,
  saveLayoutSettings,
  getLayoutSettings,
} from "@/lib/actions/customization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req["url"]);
    const key = url["searchParams"]["get"]("key");

    switch (key) {
      case "template":
        return NextResponse["json"](await getTemplateSettings());
      case "theme":
        return NextResponse["json"](await getThemeSettings());
      case "colors":
        return NextResponse["json"](await getBrandColors());
      case "fonts":
        return NextResponse["json"](await getFontSettings());
      case "layout":
        return NextResponse["json"](await getLayoutSettings());
      default:
        return NextResponse["json"]({ error: "Invalid key" }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req["json"]();
    const key = body["key"];

    switch (key) {
      case "template":
        await saveTemplateSettings(body["value"]);
        break;
      case "theme":
        await saveThemeSettings(body["value"]);
        break;
      case "colors":
        await saveBrandColors({ brandColor: body["brandColor"], accentColor: body["accentColor"] });
        break;
      case "fonts":
        await saveFontSettings(body["value"]);
        break;
      case "layout":
        await saveLayoutSettings(body["value"]);
        break;
      default:
        return NextResponse["json"]({ error: "Invalid key" }, { status: 400 });
    }

    return NextResponse["json"]({ success: true });
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}
