import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { addToQueue } from "@/lib/matchmaking";

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { topicId } = body;

    if (!topicId) {
      return NextResponse.json({ error: "topicId is required" }, { status: 400 });
    }

    const result = await addToQueue(user.id, topicId);
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to enter matchmaking queue" }, { status: 500 });
  }
}
