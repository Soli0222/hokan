import { describe, expect, it } from "vitest";
import type { Valuation } from "../types/domain";
import {
  compareInventoryOrder,
  computeDashboardSummary,
  computeItemMetrics,
  needsInventoryConfirmation,
  selectSellCandidates,
} from "./item-metrics";

const valuation = (over: Partial<Valuation>): Valuation => ({
  id: "v1",
  itemId: "i1",
  estimatedResalePrice: 0,
  estimatedOn: "2026-01-01",
  liquidity: null,
  source: null,
  estimatedBy: "owner",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("computeItemMetrics", () => {
  it("owned item uses latest valuation as proceeds", () => {
    const metrics = computeItemMetrics(
      { acquiredOn: "2025-01-21", purchasePrice: 10000, status: "owned" },
      null,
      [
        valuation({ id: "v1", estimatedResalePrice: 4000, estimatedOn: "2025-06-01" }),
        valuation({ id: "v2", estimatedResalePrice: 3000, estimatedOn: "2025-07-01" }),
      ],
      "2026-01-21",
    );
    expect(metrics.holdingDays).toBe(365);
    expect(metrics.proceeds).toBe(3000);
    expect(metrics.effectiveCost).toBe(7000);
    expect(metrics.recoveryRate).toBeCloseTo(0.3);
    expect(metrics.latestValuation?.id).toBe("v2");
  });

  it("disposed item uses disposal amount and stops at disposedOn", () => {
    const metrics = computeItemMetrics(
      { acquiredOn: "2025-01-01", purchasePrice: 10000, status: "disposed" },
      { disposedOn: "2025-02-01", amount: 5000 },
      [],
      "2026-01-21",
    );
    expect(metrics.holdingDays).toBe(31);
    expect(metrics.proceeds).toBe(5000);
    expect(metrics.effectiveCost).toBe(5000);
    expect(metrics.recoveryRate).toBeCloseTo(0.5);
    // 31日保有なので月あたりコストは実質コストを31日÷30.436875で割った額
    expect(metrics.monthlyCost).toBe(Math.round(5000 / (31 / 30.436875)));
  });

  it("amortizes effective cost over holding months", () => {
    const metrics = computeItemMetrics(
      { acquiredOn: "2025-01-21", purchasePrice: 12000, status: "disposed" },
      { disposedOn: "2026-01-20", amount: 0 },
      [],
      "2026-02-01",
    );
    // 364日 ≈ 11.96ヶ月 → 12000/11.96 ≈ 1003
    expect(metrics.monthlyCost).toBe(Math.round(12000 / (364 / 30.436875)));
  });

  it("returns nulls when acquisition date or price is unknown", () => {
    const metrics = computeItemMetrics(
      { acquiredOn: null, purchasePrice: null, status: "owned" },
      null,
      [valuation({ estimatedResalePrice: 2000 })],
      "2026-01-21",
    );
    expect(metrics.holdingDays).toBeNull();
    expect(metrics.effectiveCost).toBeNull();
    expect(metrics.monthlyCost).toBeNull();
    expect(metrics.recoveryRate).toBeNull();
    expect(metrics.proceeds).toBe(2000);
  });

  it("recoveryRate is null when purchase price is zero", () => {
    const metrics = computeItemMetrics(
      { acquiredOn: "2025-01-01", purchasePrice: 0, status: "disposed" },
      { disposedOn: "2025-02-01", amount: 100 },
      [],
      "2026-01-01",
    );
    expect(metrics.recoveryRate).toBeNull();
  });
});

describe("needsInventoryConfirmation", () => {
  it("targets unconfirmed or last-confirmed >180 days ago", () => {
    const today = "2026-07-01";
    expect(needsInventoryConfirmation(null, today)).toBe(true);
    expect(needsInventoryConfirmation("2025-12-31", today)).toBe(true);
    expect(needsInventoryConfirmation("2026-01-03", today)).toBe(false);
    expect(needsInventoryConfirmation("2026-06-30", today)).toBe(false);
    // 境界: ちょうど 180 日（2026-01-02→07-01）は対象外、181 日で対象
    expect(needsInventoryConfirmation("2026-01-02", today)).toBe(false);
    expect(needsInventoryConfirmation("2026-01-01", today)).toBe(true);
  });
});

describe("compareInventoryOrder", () => {
  it("orders by lastConfirmedOn with nulls first, id as tiebreak", () => {
    const items = [
      { id: "b", lastConfirmedOn: "2025-06-01" },
      { id: "a", lastConfirmedOn: null },
      { id: "c", lastConfirmedOn: null },
      { id: "d", lastConfirmedOn: "2025-01-01" },
    ];
    const sorted = [...items].sort(compareInventoryOrder).map((item) => item.id);
    expect(sorted).toEqual(["a", "c", "d", "b"]);
  });
});

describe("selectSellCandidates", () => {
  const items = [
    { id: "sub1", name: "a", necessityTier: "sub" as const, purchasePrice: 1000 },
    { id: "dorm1", name: "b", necessityTier: "dormant" as const, purchasePrice: 2000 },
    { id: "main1", name: "c", necessityTier: "main" as const, purchasePrice: 3000 },
    { id: "unset", name: "d", necessityTier: null, purchasePrice: 500 },
  ];
  const resale = new Map([
    ["sub1", 300],
    ["dorm1", 1000],
    ["main1", 5000],
    ["unset", 100],
  ]);

  it("picks highest-resale candidates until the shortfall is covered", () => {
    const result = selectSellCandidates(items, resale, 800);
    expect(result.candidates.map((c) => c.itemId)).toEqual(["dorm1"]);
    expect(result.total).toBe(1000);
    expect(result.covered).toBe(true);
  });

  it("accumulates candidates when one is not enough", () => {
    const result = selectSellCandidates(items, resale, 1200);
    expect(result.candidates.map((c) => c.itemId)).toEqual(["dorm1", "sub1"]);
    expect(result.total).toBe(1300);
    expect(result.covered).toBe(true);
  });

  it("reports uncovered shortfall and excluded totals", () => {
    const result = selectSellCandidates(items, resale, 5000);
    expect(result.covered).toBe(false);
    expect(result.excluded.count).toBe(2);
    expect(result.excluded.purchaseTotal).toBe(3500);
    expect(result.excluded.estimatedResaleTotal).toBe(5100);
  });

  it("excludes sub/dormant items without a valuation", () => {
    const result = selectSellCandidates(items, new Map([["sub1", 300]]), 100);
    expect(result.candidates.map((c) => c.itemId)).toEqual(["sub1"]);
    expect(result.excluded.count).toBe(3);
  });
});

describe("computeDashboardSummary", () => {
  const row = (
    item: Partial<Parameters<typeof computeDashboardSummary>[0][number]["item"]>,
    valuations: Valuation[] = [],
    disposal = null,
  ) => ({
    item: {
      category: "other",
      necessityTier: null,
      acquiredOn: null,
      purchasePrice: null,
      status: "owned" as const,
      lastConfirmedOn: "2026-01-19",
      ...item,
    },
    disposal,
    valuations,
  });

  it("aggregates owned totals, dormant totals, categories and 180-day count", () => {
    const summary = computeDashboardSummary(
      [
        row(
          {
            category: "game",
            necessityTier: "dormant",
            acquiredOn: "2025-01-20",
            purchasePrice: 10000,
            lastConfirmedOn: null,
          },
          [valuation({ estimatedResalePrice: 4000 })],
        ),
        row({ category: "game", acquiredOn: "2026-01-01", purchasePrice: 5000 }),
        row({ category: "audio", necessityTier: "sub", purchasePrice: 2000 }),
        row(
          { category: "game", status: "disposed", acquiredOn: "2025-01-01", purchasePrice: 3000 },
          [],
          { disposedOn: "2025-06-01", amount: 1000 },
        ),
      ],
      "2026-01-20",
    );

    expect(summary.ownedCount).toBe(3);
    expect(summary.ownedPurchaseTotal).toBe(17000);
    expect(summary.ownedEstimatedResaleTotal).toBe(4000);
    expect(summary.dormantCount).toBe(1);
    expect(summary.dormantPurchaseTotal).toBe(10000);
    expect(summary.dormantEstimatedResaleTotal).toBe(4000);
    // 未確認（lastConfirmedOn=null）のみ対象。残りは 2026-01-19 確認済み（1日前）。
    expect(summary.heldOver180DaysCount).toBe(1);

    const game = summary.categories.find((c) => c.category === "game");
    expect(game?.ownedCount).toBe(2);
    expect(game?.purchaseTotal).toBe(15000);
    expect(summary.categories[0].category).toBe("game");
  });
});
