import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureVerified } from "@/lib/org";
import { updateAddress, deleteAddress } from "@/lib/actions/addresses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureVerified();
    const body = await req["json"]();
    const address = await updateAddress(params["id"], {
      label: body["label"],
      type: body["type"],
      line1: body["line1"],
      line2: body["line2"],
      city: body["city"],
      state: body["state"],
      postalCode: body["postalCode"],
      country: body["country"],
      isDefault: body["isDefault"],
    });
    return NextResponse["json"](address);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: (err && err["name"] === "EmailVerificationError") ? 403 : 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureVerified();
    await deleteAddress(params["id"]);
    return NextResponse["json"]({ success: true });
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: (err && err["name"] === "EmailVerificationError") ? 403 : 400 });
  }
}
