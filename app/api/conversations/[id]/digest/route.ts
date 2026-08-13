import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const isUuid = (str?: string | null): boolean =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;

  if (!isUuid(roomId)) {
    return NextResponse.json({ error: "Digest not found" }, { status: 404 });
  }

  try {
    const digest = await prisma.conversationDigest.findUnique({
      where: { roomId },
    });

    const postChatDigest = await prisma.postChatDigest.findUnique({
      where: { roomId },
    });

    if (!digest && !postChatDigest) {
      return NextResponse.json({ error: "Digest not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        digest: digest || {
          roomId,
          summary: "Summary of dialogue",
          user1Position: postChatDigest?.summaryStanceUser1 || "",
          user2Position: postChatDigest?.summaryStanceUser2 || "",
          unresolvedQuestion: postChatDigest?.openQuestions || "",
        },
        postChatDigest,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch digest" }, { status: 500 });
  }
}
