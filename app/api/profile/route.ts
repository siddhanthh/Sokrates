import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { generateEmbedding } from "@/lib/ai/gemini";

const isUuid = (str?: string | null): boolean =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

export async function GET(req: Request) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categoryIds = user.interests.map((ui) => ui.categoryId);
    const categoryNames = user.interests.map((ui) => ui.category?.name || ui.categoryId).filter(Boolean);
    const categoryText = categoryNames.length > 0 ? categoryNames.join(" ") : categoryIds.join(" ") || "philosophy";
    const interestVec = await generateEmbedding(categoryText);

    const safeUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      suspended: user.suspended,
      interestCategories: categoryIds,
      interestVec,
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
    const { bio, avatarUrl } = body;
    const rawCategories = body.categoryIds || body.interestCategories;

    let updatedInterestVec: number[] | null = null;
    let selectedCategoryIds: string[] = user.interests.map((ui) => ui.categoryId);

    if (Array.isArray(rawCategories)) {
      selectedCategoryIds = rawCategories;
      const validUuidCatIds = selectedCategoryIds.filter(isUuid);
      const slugOrNameCatIds = selectedCategoryIds.filter((id) => !isUuid(id));

      const orConditions: any[] = [];
      if (validUuidCatIds.length > 0) orConditions.push({ id: { in: validUuidCatIds } });
      if (slugOrNameCatIds.length > 0) orConditions.push({ slug: { in: slugOrNameCatIds } });

      const categories =
        orConditions.length > 0
          ? await prisma.interestCategory.findMany({
              where: { OR: orConditions },
            })
          : [];

      const categoryText =
        categories.length > 0
          ? categories.map((c) => c.name).join(" ")
          : selectedCategoryIds.join(" ") || "philosophy";
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
          `UPDATE users SET interest_vec = $1::float4[] WHERE id = $2::uuid`,
          updatedInterestVec,
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

    const categoryTextFallback = selectedCategoryIds.join(" ") || "philosophy";
    const finalVec = updatedInterestVec || (await generateEmbedding(categoryTextFallback));

    const safeUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      avatarUrl: updatedUser.avatarUrl,
      bio: updatedUser.bio,
      role: updatedUser.role,
      suspended: updatedUser.suspended,
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

export async function POST(req: Request) {
  return PUT(req);
}

export async function PATCH(req: Request) {
  return PUT(req);
}
