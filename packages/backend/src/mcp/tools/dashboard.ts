import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CategoryContextResponse,
  DashboardResponse,
  InventoryPendingResponse,
  SellCandidatesResponse,
} from "@hokan/shared";
import { z } from "zod";
import type { HokanApiClient } from "../client";
import { formatItemsText } from "../format";
import {
  nonNegativeMoneySchema,
  readOnlyToolAnnotations,
  registerTool,
  textContent,
} from "../helpers";
import { itemCategorySchema } from "../../schemas/items";

export function registerDashboardTools(server: McpServer, apiClient: HokanApiClient) {
  registerTool(server, "get_dashboard", "保有中合計・眠り資産・カテゴリ別集計・180日超過物品数を取得する",
    {},
    readOnlyToolAnnotations,
    async () => {
      const summary = await apiClient.get<DashboardResponse>("/api/dashboard");
      return textContent(
        `保有中 ${summary.ownedCount} 件 / 取得価格計 ${summary.ownedPurchaseTotal}円 / 見込み額計 ${summary.ownedEstimatedResaleTotal}円`,
        { summary },
      );
    });

  registerTool(server, "get_sell_candidates", "不足額を埋める売却候補を見込み額の高い順に返す。sub/dormant で評価済みの物が対象",
    { shortfall: nonNegativeMoneySchema.describe("不足額（円）") },
    readOnlyToolAnnotations,
    async ({ shortfall }) => {
      const data = await apiClient.get<SellCandidatesResponse>(`/api/dashboard/sell-candidates?shortfall=${shortfall}`);
      const lines = data.candidates.map(
        (c) => `- ${c.item.name}: ${c.estimatedResalePrice}円（累計 ${c.cumulativeTotal}円）`,
      );
      return textContent(
        [`不足額 ${shortfall}円 に対し候補合計 ${data.total}円（${data.covered ? "充足" : "不足"}）`, ...lines].join("\n"),
        data,
      );
    });

  registerTool(server, "get_category_context", "カテゴリの保有物と短期保有での処分履歴を取得する。購入判断の文脈用",
    {
      category: itemCategorySchema,
      maxHoldingDays: z.number().int().min(1).max(3650).optional().describe("短期処分とみなす保有日数。既定 180"),
    },
    readOnlyToolAnnotations,
    async ({ category, maxHoldingDays }) => {
      const params = new URLSearchParams({ category });
      if (maxHoldingDays !== undefined) params.set("maxHoldingDays", String(maxHoldingDays));
      const data = await apiClient.get<CategoryContextResponse>(`/api/dashboard/category-context?${params.toString()}`);
      return textContent(
        `${category}: 保有 ${data.ownedItems.length} 件 / 短期処分 ${data.shortLivedDisposals.length} 件`,
        data,
      );
    });

  registerTool(server, "list_inventory_pending", "棚卸し対象（未確認 or 最終確認から180日超の owned）を lastConfirmedOn 古い順（未確認先頭）で返す。category と location（'unset'=未設定）で絞り込み",
    {
      category: itemCategorySchema.optional(),
      location: z.string().max(200).optional().describe("登録済み保管場所の完全一致、または 'unset' で未設定"),
    },
    readOnlyToolAnnotations,
    async (args) => {
      const params = new URLSearchParams();
      if (args.category) params.set("category", args.category);
      if (args.location !== undefined) params.set("location", args.location);
      const data = await apiClient.get<InventoryPendingResponse>(`/api/dashboard/inventory-pending?${params.toString()}`);
      return textContent(formatItemsText(data.items), { items: data.items, total: data.total });
    });
}
