import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function handlePublish(req: Request, roomId: string) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const room = await prisma.room.update({
      where: { id: roomId },
      data: {
        isPublic: true,
      },
    });

    return NextResponse.json({ success: true, room }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to publish debate" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handlePublish(req, id);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handlePublish(req, id);
}
