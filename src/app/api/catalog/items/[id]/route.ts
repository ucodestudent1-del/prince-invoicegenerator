import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCatalogItem, updateCatalogItem, deleteCatalogItem } from "@/lib/actions/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    const item = await getCatalogItem(params["id"]);
    return NextResponse["json"](item);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req["json"]();
    const item = await updateCatalogItem(params["id"], {
      name: body["name"],
      description: body["description"],
      price: body["price"],
      unit: body["unit"],
      taxRate: body["taxRate"],
      taxCategory: body["taxCategory"],
      sku: body["sku"],
      discount: body["discount"],
      isFavorite: body["isFavorite"],
    });
    return NextResponse["json"](item);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await deleteCatalogItem(params["id"]);
    return NextResponse["json"](result);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}
