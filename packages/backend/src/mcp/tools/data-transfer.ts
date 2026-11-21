import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DataExportPayload, ImportResult } from "@hokan/shared";
import { z } from "zod";
import { exportDataSchema, FORMAT_VERSION } from "../../schemas/data-transfer";
import type { HokanApiClient } from "../client";
import { deleteToolAnnotations, readOnlyToolAnnotations, registerTool, textContent } from "../helpers";

function summarize(data: { items: Array<{ disposal: unknown; valuations: unknown[] }> }) {
  return {
    items: data.items.length,
    disposals: data.items.filter((item) => item.disposal !== null).length,
    valuations: data.items.reduce((sum, item) => sum + item.valuations.length, 0),
  };
}

export function registerDataTransferTools(server: McpServer, apiClient: HokanApiClient) {
  registerTool(server, "export_data", "全データを、API のインポートへそのまま渡せる形式で取得する。機密性のある個人資産データを含む",
    {}, readOnlyToolAnnotations,
    async () => {
      const exported = await apiClient.get<DataExportPayload>("/api/export");
      return textContent(`全データを書き出しました: ${exported.exportedAt}`, { export: exported });
    });
  registerTool(server, "import_data", "全データを置換する。まず confirm なしで件数を確認し、confirm: true で実行する。export_data.export.data を data に指定する",
    { formatVersion: z.literal(FORMAT_VERSION), mode: z.literal("replace"), data: exportDataSchema.describe("取得元: export_data.export.data。すべての内部 ID と関連 ID は書き出し時の値を保つ"), confirm: z.boolean().optional() },
    deleteToolAnnotations,
    async ({ formatVersion, mode, data, confirm }) => {
      if (confirm !== true) {
        const current = await apiClient.get<DataExportPayload>("/api/export");
        const counts = summarize(data);
        const currentCounts = summarize(current.data);
        return textContent("全データの置換確認。data は検証済みですが、まだ変更していません。実行するには同じ data と confirm: true を指定してください。",
          { formatVersion, mode, counts, currentCounts, executed: false, next: { confirm: true } }, "preview");
      }
      const result = await apiClient.post<{ counts: ImportResult["counts"] }>("/api/import", { formatVersion, mode, data });
      return textContent("全データを置換しました", { counts: result.counts, executed: true });
    });
}
