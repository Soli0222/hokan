import type { DisposalListResponse, DisposalMethodValue, DisposalReasonValue } from "@hokan/shared";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card";
import { TableWrapper, Table } from "../components/ui/table";
import { useResource } from "../hooks/use-resource";
import { apiFetch } from "../lib/api";
import { formatDateWithYear, formatYen } from "../lib/format";
import { DISPOSAL_METHOD_LABELS, DISPOSAL_REASON_LABELS, ITEM_CATEGORY_LABELS, type ItemCategoryValue } from "@hokan/shared";

export function DisposalsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useResource<DisposalListResponse>(
    () => apiFetch("/api/disposals"),
    [],
  );

  return (
    <div className="grid gap-4">
      <h1 className="text-lg font-semibold">処分履歴</h1>
      {loading ? <div className="text-sm text-ink-3">読み込み中…</div> : null}
      {error ? <div className="text-sm text-critical">{error}</div> : null}
      {data ? (
        <Card className="p-0">
          <TableWrapper>
            <Table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="p-3">物品</th>
                  <th className="p-3">手放した日</th>
                  <th className="p-3">方法</th>
                  <th className="p-3 text-right">額</th>
                  <th className="p-3">理由</th>
                  <th className="p-3 text-right">保有日数</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <tr
                    key={entry.id}
                    className="cursor-pointer border-t border-line hover:bg-surface-2/60"
                    onClick={() => navigate(`/items/${entry.itemId}`)}
                  >
                    <td className="p-3">
                      <div className="font-medium">{entry.item.name}</div>
                      <div className="text-xs text-ink-3">{ITEM_CATEGORY_LABELS[entry.item.category as ItemCategoryValue] ?? entry.item.category}</div>
                    </td>
                    <td className="p-3">{formatDateWithYear(entry.disposedOn)}</td>
                    <td className="p-3">{DISPOSAL_METHOD_LABELS[entry.method as DisposalMethodValue] ?? entry.method}{entry.channel ? ` · ${entry.channel}` : ""}</td>
                    <td className="font-data p-3 text-right">{formatYen(entry.amount)}</td>
                    <td className="p-3">{entry.reason ? DISPOSAL_REASON_LABELS[entry.reason as DisposalReasonValue] : "—"}</td>
                    <td className="font-data p-3 text-right">{entry.holdingDays ?? "—"}</td>
                  </tr>
                ))}
                {data.items.length === 0 ? (
                  <tr><td className="p-6 text-sm text-ink-3" colSpan={6}>処分履歴はありません。</td></tr>
                ) : null}
              </tbody>
            </Table>
          </TableWrapper>
        </Card>
      ) : null}
    </div>
  );
}
