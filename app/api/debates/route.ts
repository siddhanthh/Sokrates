import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const debates = await prisma.room.findMany({
      where: {
        isPublic: true,
      },
      include: {
        systemTopic: {
          include: { category: true },
        },
        category: true,
        creator: true,
        participants: {
          include: { user: true },
        },
        digest: true,
        postChatDigest: true,
        argumentMap: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ debates }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch public debates" }, { status: 500 });
  }
}
