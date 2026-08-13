import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

const isUuid = (str?: string | null): boolean =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; reqId: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: roomId, reqId } = await params;

  if (!isUuid(reqId) || !isUuid(roomId)) {
    return NextResponse.json({ error: "Join request not found" }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { status } = body;

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const existingReq = await prisma.joinRequest.findUnique({
      where: { id: reqId },
    });

    if (!existingReq) {
      return NextResponse.json({ error: "Join request not found" }, { status: 404 });
    }

    const updated = await prisma.joinRequest.update({
      where: { id: reqId },
      data: {
        status: status === "approved" ? "approved" : "rejected",
      },
    });

    if (status === "approved") {
      // Add participant to room if not already added
      const existingPart = await prisma.participant.findFirst({
        where: { roomId, userId: updated.userId },
      });

      if (!existingPart) {
        await prisma.participant.create({
          data: {
            roomId,
            userId: updated.userId,
            isAi: false,
          },
        });
      }
    }

    return NextResponse.json({ request: updated }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update join request" }, { status: 500 });
  }
}
