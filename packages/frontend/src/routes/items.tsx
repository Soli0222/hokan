import type { ItemListResponse, ItemStatusValue } from "@hokan/shared";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { SegmentedControl } from "../components/ui/segmented-control";
import { Select } from "../components/ui/select";
import { StatusChip } from "../components/ui/status-chip";
import { TableWrapper, Table } from "../components/ui/table";
import { useResource } from "../hooks/use-resource";
import { apiFetch } from "../lib/api";
import { formatDateWithYear, formatYen } from "../lib/format";
import {
  ITEM_CATEGORIES,
  ITEM_CATEGORY_LABELS,
  NECESSITY_TIERS,
  NECESSITY_TIER_LABELS,
  type ItemCategoryValue,
  type NecessityTierValue,
} from "@hokan/shared";

const STATUS_OPTIONS: Array<{ value: ItemStatusValue | ""; label: string }> = [
  { value: "owned", label: "保有中" },
  { value: "disposed", label: "処分済み" },
  { value: "", label: "すべて" },
];

export function ItemsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [nameInput, setNameInput] = useState(params.get("name") ?? "");

  const name = params.get("name") ?? "";
  const category = params.get("category") ?? "";
  const status = (params.get("status") ?? "owned") as ItemStatusValue | "";
  const necessityTier = params.get("tier") ?? "";

  const query = new URLSearchParams();
  if (name) query.set("name", name);
  if (category) query.set("category", category);
  if (status) query.set("status", status);
  if (necessityTier) query.set("necessityTier", necessityTier);

  const { data, loading, error } = useResource<ItemListResponse>(
    () => apiFetch(`/api/items?${query.toString()}`),
    [name, category, status, necessityTier],
  );

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">物品一覧</h1>
        <Button onClick={() => navigate("/items/new")}>登録する</Button>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          updateParam("name", nameInput.trim());
        }}
      >
        <Input
          aria-label="物品名で検索"
          placeholder="物品名で検索"
          value={nameInput}
          onChange={(event) => setNameInput(event.target.value)}
        />
        <Select aria-label="カテゴリ" value={category} onChange={(e) => updateParam("category", e.target.value)}>
          <option value="">カテゴリ: すべて</option>
          {ITEM_CATEGORIES.map((c) => (
            <option key={c} value={c}>{ITEM_CATEGORY_LABELS[c as ItemCategoryValue]}</option>
          ))}
        </Select>
        <Select aria-label="必要度" value={necessityTier} onChange={(e) => updateParam("tier", e.target.value)}>
          <option value="">必要度: すべて</option>
          {NECESSITY_TIERS.map((t) => (
            <option key={t} value={t}>{NECESSITY_TIER_LABELS[t as NecessityTierValue]}</option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">検索</Button>
      </form>

      <SegmentedControl
        aria-label="ステータス"
        options={STATUS_OPTIONS}
        value={status}
        onChange={(value) => updateParam("status", value)}
      />

      {loading ? <div className="text-sm text-ink-3">読み込み中…</div> : null}
      {error ? <div className="text-sm text-critical">{error}</div> : null}

      {data ? (
        <Card className="p-0">
          <TableWrapper>
            <Table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="p-3">物品</th>
                  <th className="p-3">カテゴリ</th>
                  <th className="p-3">必要度</th>
                  <th className="p-3 text-right">取得価格</th>
                  <th className="p-3 text-right">見込み額</th>
                  <th className="p-3 text-right">実質コスト</th>
                  <th className="p-3">取得日</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-t border-line hover:bg-surface-2/60"
                    onClick={() => navigate(`/items/${item.id}`)}
                  >
                    <td className="p-3">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-ink-3">
                        {[item.maker, item.model].filter(Boolean).join(" ")}
                        {item.location ? ` · ${item.location}` : ""}
                      </div>
                    </td>
                    <td className="p-3">{ITEM_CATEGORY_LABELS[item.category as ItemCategoryValue] ?? item.category}</td>
                    <td className="p-3">
                      {item.necessityTier ? (
                        <StatusChip tone={item.necessityTier === "dormant" ? "warning" : "default"}>
                          {NECESSITY_TIER_LABELS[item.necessityTier as NecessityTierValue]}
                        </StatusChip>
                      ) : "—"}
                    </td>
                    <td className="font-data p-3 text-right">{formatYen(item.purchasePrice)}</td>
                    <td className="font-data p-3 text-right">{formatYen(item.metrics.latestValuation?.estimatedResalePrice ?? null)}</td>
                    <td className="font-data p-3 text-right">{formatYen(item.metrics.effectiveCost)}</td>
                    <td className="p-3 text-ink-3">
                      {formatDateWithYear(item.acquiredOn)}{item.acquiredOnApprox ? " 頃" : ""}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 ? (
                  <tr><td className="p-6 text-sm text-ink-3" colSpan={7}>該当する物品はありません。</td></tr>
                ) : null}
              </tbody>
            </Table>
          </TableWrapper>
          <div className="border-t border-line p-3 text-xs text-ink-3">{data.total} 件</div>
        </Card>
      ) : null}
    </div>
  );
}
