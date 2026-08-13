import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generatePostChatDigest, generateArgumentMap } from "@/lib/ai/gemini";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: roomId } = await params;

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        systemTopic: true,
        participants: {
          include: {
            user: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            sender: true,
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Mark room as ended
    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: {
        status: "ended",
        endedAt: new Date(),
      },
    });

    const topicTitle = room.systemTopic?.title || room.customTopic || "Philosophical Dialogue";
    const formattedMessages = room.messages.map((m) => ({
      sender: m.sender?.username || (m.isAi ? "AI Partner" : "Participant"),
      content: m.content,
      isAi: m.isAi,
    }));

    // Generate AI Digest
    const digestData = await generatePostChatDigest(topicTitle, formattedMessages);

    // Save to PostChatDigest
    const postChatDigest = await prisma.postChatDigest.upsert({
      where: { roomId },
      update: {
        summaryStanceUser1: digestData.user1Position,
        summaryStanceUser2: digestData.user2Position,
        openQuestions: digestData.unresolvedQuestion,
      },
      create: {
        roomId,
        summaryStanceUser1: digestData.user1Position,
        summaryStanceUser2: digestData.user2Position,
        openQuestions: digestData.unresolvedQuestion,
      },
    });

    // Also save to ConversationDigest for fallback/compatibility
    const conversationDigest = await prisma.conversationDigest.upsert({
      where: { roomId },
      update: {
        summary: digestData.summary,
        user1Position: digestData.user1Position,
        user2Position: digestData.user2Position,
        unresolvedQuestion: digestData.unresolvedQuestion,
      },
      create: {
        roomId,
        summary: digestData.summary,
        user1Position: digestData.user1Position,
        user2Position: digestData.user2Position,
        unresolvedQuestion: digestData.unresolvedQuestion,
      },
    });

    // Generate Argument Map
    let mapRecord = null;
    if (room.type === "ONE_ON_ONE" || formattedMessages.length >= 2) {
      const mapData = await generateArgumentMap(topicTitle, formattedMessages);
      mapRecord = await prisma.argumentMap.upsert({
        where: { roomId },
        update: {
          data: mapData as any,
        },
        create: {
          roomId,
          data: mapData as any,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        room: updatedRoom,
        digest: conversationDigest,
        postChatDigest,
        map: mapRecord,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to end room" }, { status: 500 });
  }
}
