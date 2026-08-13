import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

const isUuid = (str?: string | null): boolean =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

async function resolveTopicId(topicId: string): Promise<string | null> {
  if (isUuid(topicId)) return topicId;
  const topic = await prisma.systemTopic.findFirst({
    where: { OR: [{ title: { contains: topicId, mode: "insensitive" } }] },
  });
  if (topic) return topic.id;
  const anyTopic = await prisma.systemTopic.findFirst();
  return anyTopic ? anyTopic.id : null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: topicIdParam } = await params;
  const topicId = await resolveTopicId(topicIdParam);

  if (!topicId) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  try {
    const existing = await prisma.watchedTopic.findUnique({
      where: {
        userId_topicId: {
          userId: user.id,
          topicId,
        },
      },
    });

    if (!existing) {
      await prisma.watchedTopic.create({
        data: {
          userId: user.id,
          topicId,
        },
      });
    }

    return NextResponse.json({ success: true, isWatching: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to watch topic" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: topicIdParam } = await params;
  const topicId = await resolveTopicId(topicIdParam);

  if (!topicId) {
    return NextResponse.json({ success: true, isWatching: false }, { status: 200 });
  }

  try {
    await prisma.watchedTopic.deleteMany({
      where: {
        userId: user.id,
        topicId,
      },
    });

    return NextResponse.json({ success: true, isWatching: false }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to unwatch topic" }, { status: 500 });
  }
}
