import { afterAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "@hokan/db";
import { resetDatabase } from "@hokan/db/testing";
import type { PrismaClient } from "@hokan/db";
import { getDashboard } from "../services/items";
import { measurePerformance, writePerformanceReport } from "./report";

interface Scenario {
  name: string;
  items: number;
  disposed: number;
  valuations: number;
  samples: number;
}

const scenarios: Scenario[] = [
  { name: "dashboard small", items: 50, disposed: 10, valuations: 100, samples: 30 },
  { name: "dashboard medium", items: 500, disposed: 100, valuations: 1_000, samples: 20 },
  { name: "dashboard large", items: 5_000, disposed: 1_000, valuations: 10_000, samples: 10 },
];

const prisma = createPrismaClient({ log: ["error"] });

const CATEGORIES = [
  "pc_peripheral", "network", "audio", "appliance", "game", "hobby",
  "furniture", "vehicle", "books_media", "digital", "other",
] as const;
const TIERS = ["essential", "main", "sub", "dormant", null] as const;

async function seedScenario(prismaClient: PrismaClient, scenario: Scenario) {
  await resetDatabase(prismaClient);

  const owned = scenario.items - scenario.disposed;
  const rows = await prismaClient.item.createManyAndReturn({
    data: Array.from({ length: scenario.items }, (_, index) => ({
      name: `Perf Item ${index + 1}`,
      category: CATEGORIES[index % CATEGORIES.length],
      acquiredOn: new Date(Date.UTC(2024, index % 24, (index % 27) + 1)),
      acquisitionType: "purchase" as const,
      purchasePrice: 1_000 + (index % 500) * 100,
      conditionAtAcquisition: index % 3 === 0 ? "used" : "new",
      quantity: 1,
      location: `location-${index % 12}`,
      status: index < owned ? ("owned" as const) : ("disposed" as const),
      necessityTier: TIERS[index % TIERS.length],
      lastConfirmedOn: index % 4 === 0 ? null : new Date(Date.UTC(2026, index % 10, (index % 27) + 1)),
    })),
  });

  const disposedRows = rows.filter((row) => row.status === "disposed");
  await prismaClient.disposal.createMany({
    data: disposedRows.map((row, index) => ({
      itemId: row.id,
      disposedOn: new Date(Date.UTC(2025, index % 12, (index % 27) + 1)),
      method: index % 2 === 0 ? ("sale" as const) : ("discard" as const),
      amount: index % 2 === 0 ? 500 + (index % 200) * 50 : 0,
      reason: "unused" as const,
    })),
  });

  await prismaClient.valuation.createMany({
    data: Array.from({ length: scenario.valuations }, (_, index) => ({
      itemId: rows[index % rows.length].id,
      estimatedResalePrice: 400 + (index % 300) * 40,
      estimatedOn: new Date(Date.UTC(2026, index % 10, (index % 27) + 1)),
      liquidity: (["high", "medium", "low"] as const)[index % 3],
      estimatedBy: index % 2 === 0 ? ("owner" as const) : ("ai" as const),
    })),
  });
}

describe("dashboard performance", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  for (const scenario of scenarios) {
    it(`${scenario.name}: ${scenario.items} items`, async () => {
      await seedScenario(prisma, scenario);
      await measurePerformance(
        scenario.name,
        async () => {
          await getDashboard(prisma);
        },
        { samples: scenario.samples },
      );
      const dashboard = await getDashboard(prisma);
      expect(dashboard.ownedCount).toBe(scenario.items - scenario.disposed);
      await writePerformanceReport();
    });
  }
});
