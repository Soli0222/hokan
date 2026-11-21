import type { DisposalListResponse, ItemResponse } from "@hokan/shared";

export function formatYen(amount: number | null | undefined) {
  return amount === null || amount === undefined ? "不明" : `${amount.toLocaleString("ja-JP")}円`;
}

export function formatItemLine(item: ItemResponse) {
  const parts = [
    `${item.name} (${item.category})`,
    `status=${item.status}`,
    item.necessityTier ? `tier=${item.necessityTier}` : null,
    `取得価格=${formatYen(item.purchasePrice)}`,
    `見込み額=${formatYen(item.metrics.latestValuation?.estimatedResalePrice ?? null)}`,
  ].filter(Boolean);
  return `- ${item.id}: ${parts.join(" / ")}`;
}

export function formatItemsText(items: ItemResponse[]) {
  if (items.length === 0) {
    return "対象の物品はありません";
  }
  return items.map(formatItemLine).join("\n");
}

export function formatDisposalsText(response: DisposalListResponse) {
  if (response.items.length === 0) {
    return "処分履歴はありません";
  }
  return response.items
    .map((entry) => `- ${entry.itemId}: ${entry.item.name} / ${entry.disposedOn} / ${entry.method} / ${formatYen(entry.amount)}`)
    .join("\n");
}
