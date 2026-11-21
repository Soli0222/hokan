import { createPrismaClient } from "@hokan/db";
import { resetDatabase as resetTestDatabase } from "@hokan/db/testing";

export const testPrisma = createPrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

export async function cleanDatabase() {
  await resetTestDatabase(testPrisma);
}

export async function resetDatabase() {
  await resetTestDatabase(testPrisma);
}
