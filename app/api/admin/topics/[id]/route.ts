import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser(req);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const { title, description, categoryId } = body;

    const dataToUpdate: any = {};
    if (title) dataToUpdate.title = title;
    if (description) dataToUpdate.description = description;
    if (categoryId) dataToUpdate.categoryId = categoryId;

    const topic = await prisma.systemTopic.update({
      where: { id },
      data: dataToUpdate,
      include: { category: true },
    });

    return NextResponse.json({ topic }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update topic" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser(req);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.systemTopic.delete({ where: { id } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete topic" }, { status: 500 });
  }
}
