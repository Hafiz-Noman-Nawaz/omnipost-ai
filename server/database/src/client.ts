import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma";

/**
 * Singleton PrismaClient (docs: "one instance per process").
 * Prisma 7 requires a driver adapter; DATABASE_URL feeds it here while the
 * same var also drives migrations via prisma.config.ts.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  const connectionString =
    databaseUrl ?? process.env.DATABASE_URL ?? "postgresql://omnipost:omnipost@localhost:5434/omnipost";
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
