import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/org";
import { getTemplate, updateTemplate, deleteTemplate } from "@/lib/actions/templates";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  const template = await getTemplate(id, user["organizationId"]);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json(template);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  const body = await request.json();
  const { name, invoiceType, config, isDefault } = body;

  try {
    const template = await updateTemplate(id, user["organizationId"], {
      ...(name && { name }),
      ...(invoiceType && { invoiceType }),
      ...(config && { config }),
      ...(isDefault !== undefined && { isDefault }),
    });
    return NextResponse.json(template);
  } catch (err) {
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  if (!user || !user["organizationId"]) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  const success = await deleteTemplate(id, user["organizationId"]);
  if (!success) {
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
