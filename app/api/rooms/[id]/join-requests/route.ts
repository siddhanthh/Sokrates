import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: roomId } = await params;

  try {
    const requests = await prisma.joinRequest.findMany({
      where: { roomId },
      include: {
        user: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ requests }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch join requests" }, { status: 500 });
  }
}
