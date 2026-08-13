import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const isUuid = (str?: string | null): boolean =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;

  if (!isUuid(roomId)) {
    return NextResponse.json({ error: "Argument map not found" }, { status: 404 });
  }

  try {
    const map = await prisma.argumentMap.findUnique({
      where: { roomId },
    });

    if (!map) {
      return NextResponse.json({ error: "Argument map not found" }, { status: 404 });
    }

    return NextResponse.json({ map }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch argument map" }, { status: 500 });
  }
}
