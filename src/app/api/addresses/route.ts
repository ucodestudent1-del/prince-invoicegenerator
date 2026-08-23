import { NextRequest, NextResponse } from "next/server";
import { createAddress, getCustomerAddresses } from "@/lib/actions/addresses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req["url"]);
    const customerId = url["searchParams"]["get"]("customerId");
    if (!customerId) {
      return NextResponse["json"]({ error: "customerId is required" }, { status: 400 });
    }
    const addresses = await getCustomerAddresses(customerId);
    return NextResponse["json"](addresses);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req["json"]();
    const address = await createAddress({
      customerId: body["customerId"],
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
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}
