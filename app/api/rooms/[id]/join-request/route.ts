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
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const request = await prisma.joinRequest.upsert({
      where: {
        roomId_userId: {
          roomId,
          userId: user.id,
        },
      },
      update: {
        status: "pending",
      },
      create: {
        roomId,
        userId: user.id,
        status: "pending",
      },
    });

    return NextResponse.json({ request }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to submit join request" }, { status: 500 });
  }
}
