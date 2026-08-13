import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const topic = await prisma.systemTopic.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    const user = await getSessionUser(req);
    let isWatching = false;
    if (user) {
      const watched = await prisma.watchedTopic.findUnique({
        where: {
          userId_topicId: {
            userId: user.id,
            topicId: id,
          },
        },
      });
      isWatching = Boolean(watched);
    }

    return NextResponse.json({ topic, isWatching }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch topic" }, { status: 500 });
  }
}
