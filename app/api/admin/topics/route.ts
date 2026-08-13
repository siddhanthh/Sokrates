import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateEmbedding } from "@/lib/ai/gemini";

export async function GET(req: Request) {
  const admin = await getSessionUser(req);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const topics = await prisma.systemTopic.findMany({
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ topics }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch topics" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getSessionUser(req);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { title, description, categoryId } = body;

    if (!title || !description || !categoryId) {
      return NextResponse.json({ error: "title, description, and categoryId are required" }, { status: 400 });
    }

    const embedding = await generateEmbedding(`${title} ${description}`);

    const topic = await prisma.systemTopic.create({
      data: {
        title,
        description,
        categoryId,
      },
      include: { category: true },
    });

    return NextResponse.json({ topic }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create system topic" }, { status: 500 });
  }
}
