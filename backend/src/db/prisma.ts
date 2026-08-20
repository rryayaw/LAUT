import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../config/env.js";

function createPrismaClient(): PrismaClient | undefined {
  if (!env.DATABASE_URL) {
    return undefined;
  }

  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = createPrismaClient();
