import type {
  AcquisitionType,
  Disposal,
  DisposalMethod,
  DisposalReason,
  Item,
  ItemCategory,
  ItemCondition,
  ItemMetrics,
  NecessityTier,
  Valuation,
  ValuationEstimatedBy,
  ValuationLiquidity,
} from "./domain";
import type { DashboardSummary, SellCandidateResult } from "../lib/item-metrics";

export interface AuthStatus {
  configured: boolean;
  authenticated: boolean;
}

export interface ApiTokenSummary {
  id: string;
  name: string;
  readOnly: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreatedApiToken extends ApiTokenSummary {
  token: string;
}

/** 一覧・詳細で返す item + 導出指標。 */
export interface ItemResponse extends Item {
  metrics: ItemMetrics;
}

export interface ItemDetailResponse {
  item: ItemResponse;
  disposal: Disposal | null;
  valuations: Valuation[];
}

export interface ItemListResponse {
  items: ItemResponse[];
  total: number;
}

export interface CreateItemRequest {
  name: string;
  category: ItemCategory;
  maker?: string | null;
  model?: string | null;
  acquiredOn?: string | null;
  acquiredOnApprox?: boolean;
  acquisitionType?: AcquisitionType | null;
  purchasePrice?: number | null;
  purchaseSource?: string | null;
  conditionAtAcquisition?: ItemCondition | null;
  quantity?: number;
  purpose?: string | null;
  location?: string | null;
  necessityTier?: NecessityTier | null;
  lastConfirmedOn?: string | null;
  notes?: string | null;
}

export type UpdateItemRequest = Partial<CreateItemRequest>;

export interface ConfirmItemRequest {
  necessityTier?: NecessityTier | null;
}

export interface UpsertDisposalRequest {
  disposedOn: string;
  method: DisposalMethod;
  amount?: number | null;
  channel?: string | null;
  reason?: DisposalReason | null;
  notes?: string | null;
}

export interface DisposalListEntry extends Disposal {
  item: Pick<Item, "id" | "name" | "category" | "purchasePrice" | "acquiredOn">;
  holdingDays: number | null;
}

export interface DisposalListResponse {
  items: DisposalListEntry[];
  total: number;
}

export interface CreateValuationRequest {
  estimatedResalePrice: number;
  estimatedOn?: string;
  liquidity?: ValuationLiquidity | null;
  source?: string | null;
  estimatedBy?: ValuationEstimatedBy;
}

export interface ValuationListResponse {
  items: Valuation[];
  total: number;
}

export type DashboardResponse = DashboardSummary;

export interface SellCandidateEntry extends SellCandidateResult {
  item: ItemResponse;
}

export interface SellCandidatesResponse {
  shortfall: number;
  covered: boolean;
  total: number;
  candidates: SellCandidateEntry[];
  excluded: {
    count: number;
    purchaseTotal: number;
    estimatedResaleTotal: number;
  };
}

export interface ShortLivedDisposal {
  item: Item;
  disposal: Disposal;
  holdingDays: number | null;
}

export interface CategoryContextResponse {
  category: ItemCategory;
  maxHoldingDays: number;
  ownedItems: ItemResponse[];
  shortLivedDisposals: ShortLivedDisposal[];
}

export interface InventoryPendingResponse {
  items: ItemResponse[];
  total: number;
}

export interface DataExportItem extends Item {
  disposal: Disposal | null;
  valuations: Valuation[];
}

export interface DataExportPayloadData {
  items: DataExportItem[];
}

export interface DataExportPayload {
  formatVersion: number;
  exportedAt: string;
  data: DataExportPayloadData;
}

export interface ImportResult {
  counts: {
    items: number;
    disposals: number;
    valuations: number;
  };
}
