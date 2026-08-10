import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, signJwt } from "@/lib/auth";
import { generateFallbackEmbedding } from "@/lib/ai/gemini";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        interests: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isValid = verifyPassword(password, user.passwordHash || "");
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if ((user as any).suspended || user.role === ("suspended" as any)) {
      return NextResponse.json(
        { error: "Account suspended by administrator" },
        { status: 403 }
      );
    }

    const token = signJwt({ userId: user.id, role: user.role });

    const categoryIds = user.interests.map((ui) => ui.categoryId);
    const fallbackVec = generateFallbackEmbedding(categoryIds.join(" ") || "philosophy");

    const safeUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      interestCategories: categoryIds,
      interestVec: fallbackVec,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    return NextResponse.json({ token, user: safeUser }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
