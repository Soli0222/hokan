import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  ItemDetailResponse,
  ItemListResponse,
  ValuationListResponse,
} from "@hokan/shared";
import { z } from "zod";
import type { HokanApiClient } from "../client";
import { formatItemLine, formatItemsText } from "../format";
import {
  confirmDeleteSchema,
  createToolAnnotations,
  dateSchema,
  deletePreview,
  deleteToolAnnotations,
  moneySchema,
  nonNegativeMoneySchema,
  readOnlyToolAnnotations,
  registerTool,
  textContent,
  updateToolAnnotations,
  uuidSchema,
} from "../helpers";
import {
  acquisitionTypeSchema,
  itemCategorySchema,
  itemConditionSchema,
  itemStatusSchema,
  necessityTierSchema,
  valuationEstimatedBySchema,
  valuationLiquiditySchema,
} from "../../schemas/items";

const itemFields = {
  name: z.string().min(1).max(200).describe("物品名"),
  category: itemCategorySchema.describe("カテゴリ"),
  maker: z.string().max(200).nullable().optional().describe("メーカー"),
  model: z.string().max(200).nullable().optional().describe("型番"),
  acquiredOn: dateSchema.nullable().optional().describe("取得日 YYYY-MM-DD。概算なら acquiredOnApprox=true"),
  acquiredOnApprox: z.boolean().optional().describe("取得日が概算か"),
  acquisitionType: acquisitionTypeSchema.nullable().optional().describe("入手区分"),
  purchasePrice: nonNegativeMoneySchema.nullable().optional().describe("取得価格（円）"),
  purchaseSource: z.string().max(200).nullable().optional().describe("購入先"),
  conditionAtAcquisition: itemConditionSchema.nullable().optional().describe("取得時状態 new/used"),
  quantity: z.number().int().min(1).optional().describe("数量。1より多い物品の部分処分はできない（レコード分割の運用）"),
  purpose: z.string().nullable().optional().describe("用途"),
  location: z.string().max(200).nullable().optional().describe("保管場所"),
  necessityTier: necessityTierSchema.nullable().optional().describe("必要度: essential/main/sub/dormant"),
  lastConfirmedOn: dateSchema.nullable().optional().describe("最終確認日 YYYY-MM-DD"),
  notes: z.string().nullable().optional().describe("メモ"),
};

export function registerItemTools(server: McpServer, apiClient: HokanApiClient) {
  registerTool(server, "list_items", "物品を検索・一覧する。name 部分一致、category/status/necessityTier で絞り込み",
    {
      name: z.string().max(200).optional().describe("物品名の部分一致"),
      category: itemCategorySchema.optional(),
      status: itemStatusSchema.optional(),
      necessityTier: necessityTierSchema.optional(),
    },
    readOnlyToolAnnotations,
    async (args) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) {
        if (value !== undefined) params.set(key, String(value));
      }
      const data = await apiClient.get<ItemListResponse>(`/api/items?${params.toString()}`);
      return textContent(formatItemsText(data.items), { items: data.items, total: data.total, complete: true });
    });

  registerTool(server, "get_item", "物品の詳細（物品・処分・評価履歴・導出指標）を取得する",
    { id: uuidSchema.describe("取得元: list_items の items[].id") },
    readOnlyToolAnnotations,
    async ({ id }) => {
      const data = await apiClient.get<ItemDetailResponse>(`/api/items/${id}`);
      return textContent(formatItemLine(data.item), data);
    });

  registerTool(server, "create_item", "物品を登録する。必須は name/category/acquiredOn/purchasePrice",
    itemFields,
    createToolAnnotations,
    async (args) => {
      const data = await apiClient.post<ItemDetailResponse>("/api/items", args);
      return textContent(`物品を登録しました: ${data.item.name}`, { item: data.item, disposal: data.disposal, valuations: data.valuations });
    });

  registerTool(server, "update_item", "物品を部分更新する",
    { id: uuidSchema.describe("取得元: list_items の items[].id"), ...itemFields },
    updateToolAnnotations,
    async ({ id, ...patch }) => {
      const data = await apiClient.put<ItemDetailResponse>(`/api/items/${id}`, patch);
      return textContent(`物品を更新しました: ${data.item.name}`, { item: data.item, disposal: data.disposal, valuations: data.valuations });
    });

  registerTool(server, "delete_item", "物品を削除する。confirm: true でのみ実行",
    { id: uuidSchema.describe("取得元: list_items の items[].id"), confirm: confirmDeleteSchema },
    deleteToolAnnotations,
    async ({ id, confirm }) => {
      if (confirm !== true) {
        let summary: string | null;
        try {
          const data = await apiClient.get<ItemDetailResponse>(`/api/items/${id}`);
          summary = formatItemLine(data.item);
        } catch {
          summary = null;
        }
        return deletePreview("物品", id, summary);
      }
      await apiClient.delete(`/api/items/${id}`);
      return textContent("物品を削除しました", { id, deleted: true, executed: true });
    });

  registerTool(server, "confirm_item", "棚卸しで存在を確認する。lastConfirmedOn を当日に更新し、necessityTier 指定時は併せて変更",
    {
      id: uuidSchema.describe("取得元: list_inventory_pending の items[].id"),
      necessityTier: necessityTierSchema.nullable().optional(),
    },
    updateToolAnnotations,
    async ({ id, necessityTier }) => {
      const data = await apiClient.post<ItemDetailResponse>(`/api/items/${id}/confirm`, { necessityTier });
      return textContent(`確認しました: ${data.item.name}`, { item: data.item });
    });
}

export function registerValuationTools(server: McpServer, apiClient: HokanApiClient) {
  registerTool(server, "list_valuations", "物品の売却見込み額（評価）履歴を取得する",
    { itemId: uuidSchema.describe("取得元: list_items の items[].id") },
    readOnlyToolAnnotations,
    async ({ itemId }) => {
      const data = await apiClient.get<ValuationListResponse>(`/api/items/${itemId}/valuations`);
      return textContent(`評価 ${data.total} 件`, { items: data.items, total: data.total });
    });

  registerTool(server, "add_valuation", "物品に売却見込み額（評価）を追加する",
    {
      itemId: uuidSchema.describe("取得元: list_items の items[].id"),
      estimatedResalePrice: moneySchema.describe("見込み売却額（円）"),
      estimatedOn: dateSchema.optional().describe("評価日 YYYY-MM-DD。省略時は当日"),
      liquidity: valuationLiquiditySchema.nullable().optional(),
      source: z.string().max(200).nullable().optional().describe("根拠（相場 URL 等）"),
      estimatedBy: valuationEstimatedBySchema.optional(),
    },
    createToolAnnotations,
    async ({ itemId, ...body }) => {
      const data = await apiClient.post<ItemDetailResponse>(`/api/items/${itemId}/valuations`, body);
      return textContent(`評価を登録しました: ${data.item.name}`, { item: data.item, valuations: data.valuations });
    });
}
