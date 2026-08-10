import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, signJwt } from "@/lib/auth";
import { generateEmbedding } from "@/lib/ai/gemini";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, username, password, categoryIds } = body;

    if (!email || !username || !password) {
      return NextResponse.json(
        { error: "Missing required auth fields" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    const passwordHash = hashPassword(password);
    const role = email.includes("admin") ? "admin" : "user";
    const selectedCategoryIds: string[] = Array.isArray(categoryIds) ? categoryIds : [];

    // Fetch categories if provided to construct text for embedding
    let categoryNames: string[] = [];
    if (selectedCategoryIds.length > 0) {
      const categories = await prisma.interestCategory.findMany({
        where: {
          OR: [
            { id: { in: selectedCategoryIds.filter(id => id.includes("-") && id.length === 36) } },
            { slug: { in: selectedCategoryIds } },
            { id: { in: selectedCategoryIds } },
          ],
        },
      });
      categoryNames = categories.map((c) => c.name);
    }

    const embeddingText = categoryNames.length > 0 ? categoryNames.join(" ") : selectedCategoryIds.join(" ") || "general philosophy";
    const interestVec = await generateEmbedding(embeddingText);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        role,
        bio: "",
        avatarUrl: null,
      },
    });

    // Save interest categories linkage if valid categories exist in DB
    if (selectedCategoryIds.length > 0) {
      const validCategories = await prisma.interestCategory.findMany({
        where: {
          OR: [
            { id: { in: selectedCategoryIds } },
            { slug: { in: selectedCategoryIds } },
          ],
        },
      });

      for (const cat of validCategories) {
        await prisma.userInterest.create({
          data: {
            userId: user.id,
            categoryId: cat.id,
          },
        }).catch(() => {});
      }
    }

    // Try saving vector to interest_vec column
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE users SET interest_vec = $1::vector WHERE id = $2::uuid`,
        JSON.stringify(interestVec),
        user.id
      );
    } catch (err) {
      // Non-pgvector DB fallback handling
    }

    const token = signJwt({ userId: user.id, role: user.role });

    const safeUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      interestCategories: selectedCategoryIds,
      interestVec,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    return NextResponse.json({ token, user: safeUser }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
