export const ITEM_CATEGORIES = [
  "pc_peripheral",
  "network",
  "audio",
  "appliance",
  "game",
  "hobby",
  "furniture",
  "vehicle",
  "books_media",
  "digital",
  "other",
] as const;

export const ITEM_CATEGORY_LABELS: Record<ItemCategoryValue, string> = {
  pc_peripheral: "PC周辺機器",
  network: "ネットワーク",
  audio: "オーディオ",
  appliance: "家電",
  game: "ゲーム",
  hobby: "趣味",
  furniture: "家具",
  vehicle: "車両",
  books_media: "書籍・メディア",
  digital: "デジタル",
  other: "その他",
};

export type ItemCategoryValue = (typeof ITEM_CATEGORIES)[number];

export const ACQUISITION_TYPES = ["purchase", "gift", "prize", "other"] as const;
export const ACQUISITION_TYPE_LABELS: Record<AcquisitionTypeValue, string> = {
  purchase: "購入",
  gift: "贈与",
  prize: "懸賞・景品",
  other: "その他",
};
export type AcquisitionTypeValue = (typeof ACQUISITION_TYPES)[number];

export const ITEM_CONDITIONS = ["new", "used"] as const;
export const ITEM_CONDITION_LABELS: Record<ItemConditionValue, string> = {
  new: "新品",
  used: "中古",
};
export type ItemConditionValue = (typeof ITEM_CONDITIONS)[number];

export const ITEM_STATUSES = ["owned", "disposed"] as const;
export const ITEM_STATUS_LABELS: Record<ItemStatusValue, string> = {
  owned: "保有中",
  disposed: "手放し済み",
};
export type ItemStatusValue = (typeof ITEM_STATUSES)[number];

export const NECESSITY_TIERS = ["essential", "main", "sub", "dormant"] as const;
export const NECESSITY_TIER_LABELS: Record<NecessityTierValue, string> = {
  essential: "必須",
  main: "主力",
  sub: "サブ",
  dormant: "眠り",
};
export type NecessityTierValue = (typeof NECESSITY_TIERS)[number];

export const DISPOSAL_METHODS = ["sale", "trade_in", "discard", "transfer", "donation", "loss"] as const;
export const DISPOSAL_METHOD_LABELS: Record<DisposalMethodValue, string> = {
  sale: "売却",
  trade_in: "下取り",
  discard: "廃棄",
  transfer: "譲渡",
  donation: "寄付",
  loss: "紛失",
};
export type DisposalMethodValue = (typeof DISPOSAL_METHODS)[number];

export const DISPOSAL_REASONS = ["unused", "replaced", "broken", "not_needed", "cash", "other"] as const;
export const DISPOSAL_REASON_LABELS: Record<DisposalReasonValue, string> = {
  unused: "使わなくなった",
  replaced: "買い替え",
  broken: "故障",
  not_needed: "不要",
  cash: "換金",
  other: "その他",
};
export type DisposalReasonValue = (typeof DISPOSAL_REASONS)[number];

export const VALUATION_LIQUIDITIES = ["high", "medium", "low"] as const;
export const VALUATION_LIQUIDITY_LABELS: Record<ValuationLiquidityValue, string> = {
  high: "高",
  medium: "中",
  low: "低",
};
export type ValuationLiquidityValue = (typeof VALUATION_LIQUIDITIES)[number];

export const VALUATION_ESTIMATED_BY = ["owner", "ai"] as const;
export const VALUATION_ESTIMATED_BY_LABELS: Record<ValuationEstimatedByValue, string> = {
  owner: "自分",
  ai: "AI",
};
export type ValuationEstimatedByValue = (typeof VALUATION_ESTIMATED_BY)[number];
