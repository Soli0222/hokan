import type {
  AcquisitionTypeValue,
  DisposalMethodValue,
  DisposalReasonValue,
  ItemCategoryValue,
  ItemConditionValue,
  ItemStatusValue,
  NecessityTierValue,
  ValuationEstimatedByValue,
  ValuationLiquidityValue,
} from "../constants/items";

export type ItemCategory = ItemCategoryValue;
export type AcquisitionType = AcquisitionTypeValue;
export type ItemCondition = ItemConditionValue;
export type ItemStatus = ItemStatusValue;
export type NecessityTier = NecessityTierValue;
export type DisposalMethod = DisposalMethodValue;
export type DisposalReason = DisposalReasonValue;
export type ValuationLiquidity = ValuationLiquidityValue;
export type ValuationEstimatedBy = ValuationEstimatedByValue;

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  maker: string | null;
  model: string | null;
  acquiredOn: string | null;
  acquiredOnApprox: boolean;
  acquisitionType: AcquisitionType | null;
  purchasePrice: number | null;
  purchaseSource: string | null;
  conditionAtAcquisition: ItemCondition | null;
  quantity: number;
  purpose: string | null;
  location: string | null;
  status: ItemStatus;
  necessityTier: NecessityTier | null;
  lastConfirmedOn: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Disposal {
  id: string;
  itemId: string;
  disposedOn: string;
  method: DisposalMethod;
  amount: number | null;
  channel: string | null;
  reason: DisposalReason | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Valuation {
  id: string;
  itemId: string;
  estimatedResalePrice: number;
  estimatedOn: string;
  liquidity: ValuationLiquidity | null;
  source: string | null;
  estimatedBy: ValuationEstimatedBy;
  createdAt: string;
  updatedAt: string;
}

/** item と最新評価・処分を合わせた導出指標。金額は円の整数。 */
export interface ItemMetrics {
  /** 保有日数。acquiredOn 不明なら null。処分済みは処分日まで。 */
  holdingDays: number | null;
  /** 保有月数（30.436875 日=1ヶ月）。acquiredOn 不明なら null。 */
  holdingMonths: number | null;
  /** 直近の評価額または処分額。どちらも無ければ null。 */
  proceeds: number | null;
  /** purchasePrice - proceeds。purchasePrice 不明なら null。 */
  effectiveCost: number | null;
  /** effectiveCost / max(holdingMonths, 1)。計算不能なら null。 */
  monthlyCost: number | null;
  /** proceeds / purchasePrice（0-1+）。計算不能なら null。 */
  recoveryRate: number | null;
  /** 最新評価（estimatedOn 基準、同値は createdAt 降順の先頭）。 */
  latestValuation: Valuation | null;
}
