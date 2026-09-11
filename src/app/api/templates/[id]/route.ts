import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { deserializeDocument } from "@/lib/invoice-builder/document-operations";

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  document: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const template = await db.invoiceTemplate.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error fetching template:", error);
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = updateTemplateSchema.parse(body);

    const template = await db.invoiceTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Check permissions - only owner or org admin can update
    if (template.userId !== session.user.id && template.orgId) {
      // Check if user is org admin
      const membership = await db.organizationMembership.findFirst({
        where: {
          orgId: template.orgId,
          userId: session.user.id,
          role: { name: { in: ["OWNER", "ADMIN"] } },
        },
      });
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const updateData: any = {};
    if (validated.name) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.isDefault !== undefined) updateData.isDefault = validated.isDefault;
    if (validated.document) {
      const document = deserializeDocument(validated.document);
      updateData.configuration = document;
    }

    const updated = await db.invoiceTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ template: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Error updating template:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const template = await db.invoiceTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Check permissions
    if (template.userId !== session.user.id && template.orgId) {
      const membership = await db.organizationMembership.findFirst({
        where: {
          orgId: template.orgId,
          userId: session.user.id,
          role: { name: { in: ["OWNER", "ADMIN"] } },
        },
      });
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Don't allow deletion of system templates
    if (template.isSystem) {
      return NextResponse.json({ error: "Cannot delete system template" }, { status: 403 });
    }

    await db.invoiceTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}