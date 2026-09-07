import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/org";
import { getTemplates, createTemplate } from "@/lib/actions/templates";
import { getDefaultTemplate } from "@/lib/invoice-template-config";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request["url"]);
  const id = searchParams.get("id");

  if (id) {
    const { getTemplate } = await import("@/lib/actions/templates");
    const template = await getTemplate(id, user["organizationId"]);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json(template);
  }

  const templates = await getTemplates(user["organizationId"]);
  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, invoiceType, config } = body;

  if (!invoiceType) {
    return NextResponse.json({ error: "invoiceType is required" }, { status: 400 });
  }

  const templateConfig = config ?? getDefaultTemplate(invoiceType);

  try {
    const template = await createTemplate(
      user["organizationId"],
      user["id"],
      name ?? `${invoiceType} Template`,
      invoiceType,
      templateConfig
    );
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
