import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { generateEmbedding, generateFallbackEmbedding } from "@/lib/ai/gemini";

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

export async function PUT(req: Request) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { bio, avatarUrl, categoryIds } = body;

    let updatedInterestVec: number[] | null = null;
    let selectedCategoryIds: string[] = user.interests.map((ui) => ui.categoryId);

    if (Array.isArray(categoryIds)) {
      selectedCategoryIds = categoryIds;
      // Fetch category names for vector generation
      const categories = await prisma.interestCategory.findMany({
        where: {
          OR: [
            { id: { in: selectedCategoryIds } },
            { slug: { in: selectedCategoryIds } },
          ],
        },
      });

      const categoryText = categories.length > 0 ? categories.map((c) => c.name).join(" ") : selectedCategoryIds.join(" ");
      updatedInterestVec = await generateEmbedding(categoryText);

      // Re-link user interests
      await prisma.userInterest.deleteMany({
        where: { userId: user.id },
      });

      for (const cat of categories) {
        await prisma.userInterest.create({
          data: {
            userId: user.id,
            categoryId: cat.id,
          },
        }).catch(() => {});
      }

      // Update vector in DB
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE users SET interest_vec = $1::vector WHERE id = $2::uuid`,
          JSON.stringify(updatedInterestVec),
          user.id
        );
      } catch (err) {
        // Non-pgvector DB fallback handling
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(bio !== undefined ? { bio } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      },
    });

    const finalVec = updatedInterestVec || generateFallbackEmbedding(selectedCategoryIds.join(" ") || "philosophy");

    const safeUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      avatarUrl: updatedUser.avatarUrl,
      bio: updatedUser.bio,
      role: updatedUser.role,
      interestCategories: selectedCategoryIds,
      interestVec: finalVec,
      createdAt: updatedUser.createdAt.toISOString(),
      updatedAt: updatedUser.updatedAt.toISOString(),
    };

    return NextResponse.json({ user: safeUser }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  return PUT(req);
}
