import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCatalogItem, getCatalogItems, duplicateCatalogItem, toggleCatalogItemFavorite } from "@/lib/actions/catalog";
import { isMissingColumnError, ensureVerified } from "@/lib/org";
import { checkRateLimit } from "@/lib/action-rate-limit";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureVerified();
    const url = new URL(req["url"]);
    const params: Record<string, any> = {};
    if (url["searchParams"]["get"]("search")) params["search"] = url["searchParams"]["get"]("search")!;
    if (url["searchParams"]["get"]("unit")) params["unit"] = url["searchParams"]["get"]("unit")!;
    if (url["searchParams"]["get"]("limit")) params["limit"] = Number(url["searchParams"]["get"]("limit"));
    if (url["searchParams"]["get"]("favoritesOnly") === "true") params["favoritesOnly"] = true;

    const items = await getCatalogItems(params);
    return NextResponse["json"](items);
  } catch (err: any) {
    if (isMissingColumnError(err)) {
      return NextResponse["json"]([], { status: 200 });
    }
    if (err && err["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 403 });
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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureVerified();

    if (!(await checkRateLimit(`api:catalog:${session.user.email}`, 30, 60 * 1000))) {
      return NextResponse["json"]({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req["json"]();
    const item = await createCatalogItem({
      name: body["name"],
      description: body["description"],
      price: body["price"],
      unit: body["unit"] || "UNITS",
      taxRate: body["taxRate"] || 0,
      taxCategory: body["taxCategory"],
      sku: body["sku"],
      discount: body["discount"] || 0,
    });
    return NextResponse["json"](item, { status: 201 });
  } catch (err: any) {
    if (err && err["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 403 });
    }
    if (err && err["name"] === "ActionError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 400 });
    }
    logError("api:error", err);
    return NextResponse["json"]({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

