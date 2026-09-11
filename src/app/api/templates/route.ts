import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { serializeDocument, deserializeDocument } from "@/lib/invoice-builder/document-operations";

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  invoiceType: z.string(),
  document: z.string(), // JSON serialized document
  isDefault: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const invoiceType = searchParams.get("invoiceType");

    const where: any = {
      OR: [
        { orgId: orgId || undefined },
        { orgId: null, isSystem: true },
      ],
    };

    if (invoiceType) {
      where.invoiceType = invoiceType;
    }

    const templates = await db.invoiceTemplate.findMany({
      where,
      orderBy: [{ isSystem: "desc" }, { createdAt: "desc" }],
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = templateSchema.parse(body);

    const document = deserializeDocument(validated.document);

    const template = await db.invoiceTemplate.create({
      data: {
        orgId: body.orgId || null,
        userId: session.user.id,
        name: validated.name,
        invoiceType: validated.invoiceType as any,
        configuration: document as any,
        isDefault: validated.isDefault || false,
        isSystem: false,
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Error creating template:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}