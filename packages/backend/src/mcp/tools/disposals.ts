import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DisposalListResponse, ItemDetailResponse } from "@hokan/shared";
import { z } from "zod";
import type { HokanApiClient } from "../client";
import { formatDisposalsText, formatItemLine } from "../format";
import {
  confirmDeleteSchema,
  dateSchema,
  deletePreview,
  deleteToolAnnotations,
  nonNegativeMoneySchema,
  readOnlyToolAnnotations,
  registerTool,
  textContent,
  updateToolAnnotations,
  uuidSchema,
} from "../helpers";
import { disposalMethodSchema, disposalReasonSchema } from "../../schemas/items";

const disposalFields = {
  disposedOn: dateSchema.describe("手放した日 YYYY-MM-DD"),
  method: disposalMethodSchema.describe("方法: sale/trade_in/discard/transfer/donation/loss"),
  amount: nonNegativeMoneySchema.nullable().optional().describe("売却額等（円）"),
  channel: z.string().max(200).nullable().optional().describe("経路（メルカリ等）"),
  reason: disposalReasonSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
};

export function registerDisposalTools(server: McpServer, apiClient: HokanApiClient) {
  registerTool(server, "list_disposals", "処分履歴を一覧する",
    {},
    readOnlyToolAnnotations,
    async () => {
      const data = await apiClient.get<DisposalListResponse>("/api/disposals");
      return textContent(formatDisposalsText(data), { items: data.items, total: data.total });
    });

  registerTool(server, "record_disposal", "物品を手放した処分を登録する（物品は status=disposed になる）",
    { itemId: uuidSchema.describe("取得元: list_items の items[].id"), ...disposalFields },
    updateToolAnnotations,
    async ({ itemId, ...body }) => {
      const data = await apiClient.put<ItemDetailResponse>(`/api/items/${itemId}/disposal`, body);
      return textContent(`処分を登録しました: ${data.item.name}`, { item: data.item, disposal: data.disposal });
    });

  registerTool(server, "update_disposal", "登録済みの処分内容を修正する",
    { itemId: uuidSchema.describe("取得元: list_disposals の items[].itemId"), ...disposalFields },
    updateToolAnnotations,
    async ({ itemId, ...body }) => {
      const data = await apiClient.put<ItemDetailResponse>(`/api/items/${itemId}/disposal`, body);
      return textContent(`処分を更新しました: ${data.item.name}`, { item: data.item, disposal: data.disposal });
    });

  registerTool(server, "delete_disposal", "処分登録を取り消す（物品は status=owned に戻る）。confirm: true でのみ実行",
    { itemId: uuidSchema.describe("取得元: list_disposals の items[].itemId"), confirm: confirmDeleteSchema },
    deleteToolAnnotations,
    async ({ itemId, confirm }) => {
      if (confirm !== true) {
        let summary: string | null;
        try {
          const data = await apiClient.get<ItemDetailResponse>(`/api/items/${itemId}`);
          summary = data.disposal ? formatItemLine(data.item) : null;
        } catch {
          summary = null;
        }
        return deletePreview("処分", itemId, summary);
      }
      await apiClient.delete(`/api/items/${itemId}/disposal`);
      return textContent("処分を取り消しました", { id: itemId, deleted: true, executed: true });
    });
}
