import { PrismaClient, createPrismaClient } from "@hokan/db";

declare global {
  var __hokanPrisma__: PrismaClient | undefined;
}

export const prisma =
  globalThis.__hokanPrisma__ ??
  createPrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__hokanPrisma__ = prisma;
}
