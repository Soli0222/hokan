import type { PrismaClient } from "./generated/prisma/client.mts";

/**
 * 開発用の最小シード。実データの投入は UI か `POST /api/import` で行う。
 */
export async function seedDatabase(prisma: PrismaClient) {
  void prisma;
  // シードデータなし
}
