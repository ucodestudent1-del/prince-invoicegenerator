import { NextRequest, NextResponse } from "next/server";
import { createCatalogItem, getCatalogItems, duplicateCatalogItem, toggleCatalogItemFavorite } from "@/lib/actions/catalog";
import { isMissingColumnError } from "@/lib/org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const params: Record<string, any> = {};
    if (url.searchParams.get("search")) params.search = url.searchParams.get("search")!;
    if (url.searchParams.get("unit")) params.unit = url.searchParams.get("unit")!;
    if (url.searchParams.get("limit")) params.limit = Number(url.searchParams.get("limit"));
    if (url.searchParams.get("favoritesOnly") === "true") params.favoritesOnly = true;

    const items = await getCatalogItems(params);
    return NextResponse.json(items);
  } catch (err: any) {
    if (isMissingColumnError(err)) {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const item = await createCatalogItem({
      name: body.name,
      description: body.description,
      price: body.price,
      unit: body.unit || "UNITS",
      taxRate: body.taxRate || 0,
      taxCategory: body.taxCategory,
      sku: body.sku,
      discount: body.discount || 0,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
