import type { ItemMetrics, NecessityTier, Valuation } from "../types/domain";
import { DAYS_PER_MONTH, daysBetween, todayDateString } from "./dates";

export interface MetricInput {
  acquiredOn: string | null;
  purchasePrice: number | null;
  status: "owned" | "disposed";
}

export function latestValuationOf(valuations: Valuation[]): Valuation | null {
  if (valuations.length === 0) {
    return null;
  }
  return [...valuations].sort((a, b) =>
    b.estimatedOn.localeCompare(a.estimatedOn) || b.createdAt.localeCompare(a.createdAt),
  )[0];
}

export function computeItemMetrics(
  item: MetricInput,
  disposal: { disposedOn: string; amount: number | null } | null,
  valuations: Valuation[],
  today: string = todayDateString(),
): ItemMetrics {
  const latest = latestValuationOf(valuations);

  const endDate = disposal?.disposedOn ?? today;
  const holdingDays = item.acquiredOn === null ? null : daysBetween(item.acquiredOn, endDate);
  const holdingMonths = holdingDays === null ? null : holdingDays / DAYS_PER_MONTH;

  const proceeds = item.status === "disposed"
    ? (disposal?.amount ?? null)
    : (latest?.estimatedResalePrice ?? null);

  const effectiveCost = item.purchasePrice === null || proceeds === null
    ? null
    : item.purchasePrice - proceeds;

  const monthlyCost = effectiveCost === null || holdingMonths === null
    ? null
    : Math.round(effectiveCost / Math.max(holdingMonths, 1));

  const recoveryRate = item.purchasePrice === null || item.purchasePrice === 0 || proceeds === null
    ? null
    : proceeds / item.purchasePrice;

  return { holdingDays, holdingMonths, proceeds, effectiveCost, monthlyCost, recoveryRate, latestValuation: latest };
}

/** 棚卸し対象の並び順: lastConfirmedOn 古い順（NULL 先頭）、同値は id 順。 */
export function compareInventoryOrder(
  a: { lastConfirmedOn: string | null; id: string },
  b: { lastConfirmedOn: string | null; id: string },
): number {
  if (a.lastConfirmedOn === null && b.lastConfirmedOn !== null) return -1;
  if (a.lastConfirmedOn !== null && b.lastConfirmedOn === null) return 1;
  if (a.lastConfirmedOn !== null && b.lastConfirmedOn !== null) {
    const byDate = a.lastConfirmedOn.localeCompare(b.lastConfirmedOn);
    if (byDate !== 0) return byDate;
  }
  return a.id.localeCompare(b.id);
}

const SELL_CANDIDATE_TIERS: ReadonlySet<NecessityTier> = new Set(["sub", "dormant"]);

export interface SellCandidateInput {
  id: string;
  name: string;
  necessityTier: NecessityTier | null;
  purchasePrice: number | null;
}

export interface SellCandidateResult {
  itemId: string;
  estimatedResalePrice: number;
  cumulativeTotal: number;
}

export interface SellCandidatesResult {
  candidates: SellCandidateResult[];
  total: number;
  covered: boolean;
  excluded: {
    count: number;
    purchaseTotal: number;
    estimatedResaleTotal: number;
  };
}

/**
 * 不足額 shortfall を埋める売却候補。sub/dormant の保有物を最新売却見込み額の
 * 降順に並べ、合計が不足額に達するまで返す。見込み額が無い物は候補にしない。
 */
export function selectSellCandidates(
  items: SellCandidateInput[],
  latestResaleByItemId: ReadonlyMap<string, number>,
  shortfall: number,
): SellCandidatesResult {
  const eligible: Array<{ id: string; price: number }> = [];
  let excludedCount = 0;
  let excludedPurchaseTotal = 0;
  let excludedEstimatedTotal = 0;

  for (const item of items) {
    const tierOk = item.necessityTier !== null && SELL_CANDIDATE_TIERS.has(item.necessityTier);
    const price = latestResaleByItemId.get(item.id);
    if (tierOk && price !== undefined) {
      eligible.push({ id: item.id, price });
    } else {
      excludedCount += 1;
      excludedPurchaseTotal += item.purchasePrice ?? 0;
      excludedEstimatedTotal += price ?? 0;
    }
  }

  eligible.sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));

  const candidates: SellCandidateResult[] = [];
  let total = 0;
  for (const entry of eligible) {
    if (total >= shortfall) {
      break;
    }
    total += entry.price;
    candidates.push({ itemId: entry.id, estimatedResalePrice: entry.price, cumulativeTotal: total });
  }

  return {
    candidates,
    total,
    covered: total >= shortfall,
    excluded: {
      count: excludedCount,
      purchaseTotal: excludedPurchaseTotal,
      estimatedResaleTotal: excludedEstimatedTotal,
    },
  };
}

export interface CategorySummary {
  category: string;
  ownedCount: number;
  purchaseTotal: number;
  estimatedResaleTotal: number;
}

export interface DashboardSummary {
  ownedCount: number;
  ownedPurchaseTotal: number;
  ownedEstimatedResaleTotal: number;
  ownedEffectiveCostTotal: number;
  dormantCount: number;
  dormantPurchaseTotal: number;
  dormantEstimatedResaleTotal: number;
  heldOver180DaysCount: number;
  categories: CategorySummary[];
}

export interface DashboardItemInput extends MetricInput {
  category: string;
  necessityTier: NecessityTier | null;
}

export function computeDashboardSummary(
  rows: Array<{
    item: DashboardItemInput;
    disposal: { disposedOn: string; amount: number | null } | null;
    valuations: Valuation[];
  }>,
  today: string = todayDateString(),
): DashboardSummary {
  const summary: DashboardSummary = {
    ownedCount: 0,
    ownedPurchaseTotal: 0,
    ownedEstimatedResaleTotal: 0,
    ownedEffectiveCostTotal: 0,
    dormantCount: 0,
    dormantPurchaseTotal: 0,
    dormantEstimatedResaleTotal: 0,
    heldOver180DaysCount: 0,
    categories: [],
  };
  const byCategory = new Map<string, CategorySummary>();

  for (const { item, disposal, valuations } of rows) {
    if (item.status !== "owned") {
      continue;
    }
    const metrics = computeItemMetrics(item, disposal, valuations, today);
    const purchase = item.purchasePrice ?? 0;
    const estimate = metrics.latestValuation?.estimatedResalePrice ?? 0;

    summary.ownedCount += 1;
    summary.ownedPurchaseTotal += purchase;
    summary.ownedEstimatedResaleTotal += estimate;
    summary.ownedEffectiveCostTotal += metrics.effectiveCost ?? purchase;

    if (item.necessityTier === "dormant") {
      summary.dormantCount += 1;
      summary.dormantPurchaseTotal += purchase;
      summary.dormantEstimatedResaleTotal += estimate;
    }
    if (metrics.holdingDays !== null && metrics.holdingDays > 180) {
      summary.heldOver180DaysCount += 1;
    }

    let category = byCategory.get(item.category);
    if (!category) {
      category = { category: item.category, ownedCount: 0, purchaseTotal: 0, estimatedResaleTotal: 0 };
      byCategory.set(item.category, category);
      summary.categories.push(category);
    }
    category.ownedCount += 1;
    category.purchaseTotal += purchase;
    category.estimatedResaleTotal += estimate;
  }

  summary.categories.sort((a, b) => b.ownedCount - a.ownedCount || a.category.localeCompare(b.category));
  return summary;
}
