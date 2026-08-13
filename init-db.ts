process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/sokrates?schema=public";
process.env.DIRECT_URL = "postgresql://postgres:postgres@localhost:5432/sokrates?schema=public";

import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe("CREATE DOMAIN vector AS float4[];");
    console.log("Vector domain created!");
  } catch (err: any) {
    console.log("Vector domain result/error:", err.message);
  }
  try {
    await prisma.$executeRawUnsafe("CREATE DOMAIN tsvector AS text;");
    console.log("Tsvector domain created!");
  } catch (err: any) {
    console.log("Tsvector domain result/error:", err.message);
  }
  await prisma.$disconnect();
}

main();
