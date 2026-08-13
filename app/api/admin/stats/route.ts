import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const totalUsers = await prisma.user.count();
    const totalRooms = await prisma.room.count();
    const activeRooms = await prisma.room.count({
      where: { status: "active" },
    });
    const totalDebates = await prisma.room.count({
      where: { isPublic: true },
    });

    return NextResponse.json(
      {
        stats: {
          totalUsers,
          totalRooms,
          activeRooms,
          totalDebates,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch admin stats" }, { status: 500 });
  }
}
