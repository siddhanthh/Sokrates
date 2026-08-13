import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getQueueStatus } from "@/lib/matchmaking";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getQueueStatus(user.id);
    return NextResponse.json(status, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to get queue status" }, { status: 500 });
  }
}
