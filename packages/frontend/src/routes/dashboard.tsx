import type { DashboardResponse } from "@hokan/shared";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/card";
import { StatusChip } from "../components/ui/status-chip";
import { TableWrapper, Table } from "../components/ui/table";
import { useResource } from "../hooks/use-resource";
import { apiFetch } from "../lib/api";
import { formatYen } from "../lib/format";
import { ITEM_CATEGORY_LABELS, type ItemCategoryValue } from "@hokan/shared";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="font-data mt-1 text-2xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs text-ink-3">{sub}</div> : null}
    </Card>
  );
}

export function DashboardPage() {
  const { data, loading, error } = useResource<DashboardResponse>(
    () => apiFetch("/api/dashboard"),
    [],
  );

  if (loading) return <div className="p-6 text-sm text-ink-3">読み込み中…</div>;
  if (error || !data) return <div className="p-6 text-sm text-critical">{error ?? "取得に失敗しました"}</div>;

  return (
    <div className="grid gap-4">
      <h1 className="text-lg font-semibold">ダッシュボード</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="保有中" value={`${data.ownedCount} 件`} sub={`見込み額計 ${formatYen(data.ownedEstimatedResaleTotal)}`} />
        <StatCard label="取得価格計" value={formatYen(data.ownedPurchaseTotal)} />
        <StatCard label="実質コスト計" value={formatYen(data.ownedEffectiveCostTotal)} sub="取得価格 − 見込み額" />
        <StatCard
          label="180日超過"
          value={`${data.heldOver180DaysCount} 件`}
          sub="未確認 or 最終確認から180日超"
        />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">眠り資産（dormant）</h2>
          <StatusChip tone="warning">{data.dormantCount} 件</StatusChip>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatCard label="取得価格計" value={formatYen(data.dormantPurchaseTotal)} />
          <StatCard label="売却見込み計" value={formatYen(data.dormantEstimatedResaleTotal)} />
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">カテゴリ別集計</h2>
        <TableWrapper className="mt-3">
          <Table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th className="py-1 pr-4">カテゴリ</th>
                <th className="py-1 pr-4 text-right">件数</th>
                <th className="py-1 pr-4 text-right">取得価格計</th>
                <th className="py-1 text-right">見込み額計</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((row) => (
                <tr key={row.category} className="border-t border-line">
                  <td className="py-2 pr-4">{ITEM_CATEGORY_LABELS[row.category as ItemCategoryValue] ?? row.category}</td>
                  <td className="font-data py-2 pr-4 text-right">{row.ownedCount}</td>
                  <td className="font-data py-2 pr-4 text-right">{formatYen(row.purchaseTotal)}</td>
                  <td className="font-data py-2 text-right">{formatYen(row.estimatedResaleTotal)}</td>
                </tr>
              ))}
              {data.categories.length === 0 ? (
                <tr><td className="py-4 text-sm text-ink-3" colSpan={4}>保有中の物品はありません。<Link to="/items/new" className="text-brand">登録する</Link></td></tr>
              ) : null}
            </tbody>
          </Table>
        </TableWrapper>
      </Card>
    </div>
  );
}
