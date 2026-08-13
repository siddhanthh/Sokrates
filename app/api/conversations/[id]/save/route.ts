import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: roomId } = await params;

  try {
    const saved = await prisma.savedConversation.upsert({
      where: {
        roomId_userId: {
          roomId,
          userId: user.id,
        },
      },
      update: {},
      create: {
        roomId,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, saved }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to save conversation" }, { status: 500 });
  }
}
