import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { removeFromQueue } from "@/lib/matchmaking";

async function handleLeave(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { topicId } = body;

    await removeFromQueue(user.id, topicId);
    return NextResponse.json({ success: true, message: "Left queue" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to leave queue" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return handleLeave(req);
}

export async function DELETE(req: Request) {
  return handleLeave(req);
}
