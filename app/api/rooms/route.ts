import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateConversationStarters } from "@/lib/ai/gemini";

const isUuid = (str?: string | null): boolean =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const topicId = searchParams.get("topicId") || searchParams.get("systemTopicId");
    const categoryId = searchParams.get("categoryId");
    const type = searchParams.get("type");
    const search = searchParams.get("search") || searchParams.get("q");

    const where: any = {
      status: { in: ["waiting", "active"] },
    };

    if (isUuid(topicId)) {
      where.systemTopicId = topicId;
    }

    if (isUuid(categoryId)) {
      where.categoryId = categoryId;
    }

    if (type) {
      const upperType = type.toUpperCase();
      where.type = upperType === "1ON1" || upperType === "ONE_ON_ONE" ? "ONE_ON_ONE" : "GROUP";
    }

    if (search) {
      where.OR = [
        { customTopic: { contains: search, mode: "insensitive" } },
        { customDescription: { contains: search, mode: "insensitive" } },
        { systemTopic: { title: { contains: search, mode: "insensitive" } } },
      ];
    }

    const rooms = await prisma.room.findMany({
      where,
      include: {
        systemTopic: true,
        category: true,
        creator: true,
        participants: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ rooms }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch rooms" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { customTopic, customDescription, categoryId, cap = 10 } = body;

    if (!customTopic) {
      return NextResponse.json({ error: "customTopic is required for group room" }, { status: 400 });
    }

    if (cap < 2 || cap > 20) {
      return NextResponse.json({ error: "Cap must be between 2 and 20" }, { status: 400 });
    }

    let validCategoryId: string | null = null;
    if (isUuid(categoryId)) {
      validCategoryId = categoryId;
    } else if (categoryId) {
      const cat = await prisma.interestCategory.findFirst({ where: { slug: categoryId } });
      validCategoryId = cat ? cat.id : null;
    }

    const room = await prisma.room.create({
      data: {
        type: "GROUP",
        customTopic,
        customDescription,
        categoryId: validCategoryId,
        createdBy: user.id,
        cap,
        status: "active",
        hasAi: false,
        isPublic: false,
        participants: {
          create: [{ userId: user.id, isAi: false }],
        },
      },
      include: {
        category: true,
        creator: true,
        participants: {
          include: { user: true },
        },
      },
    });

    // Generate 3 AI conversation starter questions via Gemini 2.0 Flash
    const starters = await generateConversationStarters(
      customTopic,
      customDescription,
      room.category?.name
    );

    await prisma.conversationStarter.create({
      data: {
        roomId: room.id,
        questions: starters,
      },
    });

    return NextResponse.json({ room, starters }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create group room" }, { status: 500 });
  }
}
