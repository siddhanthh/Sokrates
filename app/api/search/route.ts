import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  try {
    if (!q) {
      return NextResponse.json({ results: { topics: [], rooms: [] } }, { status: 200 });
    }

    const topics = await prisma.systemTopic.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { category: true },
    });

    const rooms = await prisma.room.findMany({
      where: {
        OR: [
          { customTopic: { contains: q, mode: "insensitive" } },
          { customDescription: { contains: q, mode: "insensitive" } },
        ],
      },
      include: {
        category: true,
        creator: true,
        participants: { include: { user: true } },
      },
    });

    return NextResponse.json({ results: { topics, rooms } }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Search failed" }, { status: 500 });
  }
}
