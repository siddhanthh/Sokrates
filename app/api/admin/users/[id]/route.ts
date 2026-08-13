import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser(req);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  const { id: targetUserId } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const { suspended, role } = body;

    const dataToUpdate: any = {};
    if (typeof suspended === "boolean") dataToUpdate.suspended = suspended;
    if (role && ["user", "admin"].includes(role)) dataToUpdate.role = role;

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        suspended: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ user: updatedUser }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}
