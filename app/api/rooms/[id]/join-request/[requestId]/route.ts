import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; requestId?: string; reqId?: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const p = await params;
  const roomId = p.id;
  const requestId = p.requestId || p.reqId;

  if (!requestId) {
    return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { status } = body;

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const updated = await prisma.joinRequest.update({
      where: { id: requestId },
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

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string; requestId?: string; reqId?: string }> }
) {
  return PATCH(req, ctx);
}
