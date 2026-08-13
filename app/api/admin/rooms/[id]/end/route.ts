import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser(req);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  const { id: roomId } = await params;

  try {
    const room = await prisma.room.update({
      where: { id: roomId },
      data: {
        status: "ended",
        endedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, room }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to force end room" }, { status: 500 });
  }
}
