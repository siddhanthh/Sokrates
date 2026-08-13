process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/sokrates?schema=public";
process.env.DIRECT_URL = process.env.DIRECT_URL || "postgresql://postgres:postgres@localhost:5432/sokrates?schema=public";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Ensuring all columns exist in PostgreSQL...");

  const statements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS interest_vec float4[];`,
    `ALTER TABLE system_topics ADD COLUMN IF NOT EXISTS embedding float4[];`,
    `ALTER TABLE system_topics ADD COLUMN IF NOT EXISTS search_vector text;`,
    `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS search_vector text;`,
  ];

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (err: any) {
      console.log("Statement status:", err.message);
    }
  }
  console.log("PostgreSQL columns setup complete!");
}

main()
  .catch((e) => {
    console.error("Error setting up database columns:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
