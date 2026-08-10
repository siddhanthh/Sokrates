import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const defaultCategories = [
  { id: "cat-1", name: "Philosophy", slug: "philosophy", icon: "🧠" },
  { id: "cat-2", name: "Ethics", slug: "ethics", icon: "⚖️" },
  { id: "cat-3", name: "Metaphysics", slug: "metaphysics", icon: "🌌" },
  { id: "cat-4", name: "Epistemology", slug: "epistemology", icon: "📖" },
  { id: "cat-5", name: "Political Philosophy", slug: "politics", icon: "🏛️" },
  { id: "cat-6", name: "Logic", slug: "logic", icon: "🧩" },
];

export async function GET() {
  try {
    const categories = await prisma.interestCategory.findMany();
    if (categories.length > 0) {
      return NextResponse.json({ categories }, { status: 200 });
    }
  } catch (error) {
    // Fallback to default categories
  }

  return NextResponse.json({ categories: defaultCategories }, { status: 200 });
}
