import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { generateFallbackEmbedding } from "@/lib/ai/gemini";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    return NextResponse.json({ user: safeUser }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
