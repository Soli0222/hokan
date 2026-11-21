import type { PrismaClient } from "./generated/prisma/client.mts";

const DATA_TABLES = [
  "valuations",
  "disposals",
  "items",
];

const AUTH_TABLES = ["auth_sessions", "api_tokens"];

function buildTruncateSql(tables: string[]) {
  const joined = tables.map((table) => `"${table}"`).join(",\n    ");
  return `
  TRUNCATE TABLE
    ${joined}
  RESTART IDENTITY CASCADE
`;
}

const TRUNCATE_DATA_TABLES_SQL = buildTruncateSql(DATA_TABLES);
const TRUNCATE_TABLES_SQL = buildTruncateSql([...DATA_TABLES, ...AUTH_TABLES]);

export async function resetDatabase(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(TRUNCATE_TABLES_SQL);
}

export async function resetDatabaseForE2e(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(TRUNCATE_DATA_TABLES_SQL);
}

export async function resetAuth(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(buildTruncateSql(AUTH_TABLES));
}
