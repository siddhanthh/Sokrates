import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser(req);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  const { id: targetUserId } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const suspended = typeof body.suspended === "boolean" ? body.suspended : true;

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { suspended },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        suspended: true,
        bio: true,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to suspend user" }, { status: 500 });
  }
}
