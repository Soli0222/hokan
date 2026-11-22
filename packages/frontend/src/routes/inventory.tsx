import type { InventoryPendingResponse, ItemCategoryValue, NecessityTierValue } from "@hokan/shared";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Select } from "../components/ui/select";
import { StatusChip } from "../components/ui/status-chip";
import { useResource } from "../hooks/use-resource";
import { apiFetch } from "../lib/api";
import { formatDateWithYear, formatYen } from "../lib/format";
import {
  ITEM_CATEGORIES,
  ITEM_CATEGORY_LABELS,
  NECESSITY_TIERS,
  NECESSITY_TIER_LABELS,
} from "@hokan/shared";

/**
 * 棚卸し画面（仕様 4.2）。対象は owned かつ未確認 or 最終確認から180日超の物品のみ、
 * lastConfirmedOn 古い順（NULL 先頭、同値は id 順）をバックエンドが返す。
 * 「確認した」で対象から消え、残り件数が減る。M は画面を開いた時点の件数を
 * メモリに保持し、スキップは DB を変えずその場で再表示しないだけ。
 */
export function InventoryPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");

  const query = new URLSearchParams();
  if (category) query.set("category", category);
  if (location) query.set("location", location);

  const { data, loading, error, setData } = useResource<InventoryPendingResponse>(
    () => apiFetch(`/api/dashboard/inventory-pending?${query.toString()}`),
    [category, location],
  );

  // 保管場所の選択肢は絞り込み前の全対象から取る
  const { data: unfiltered } = useResource<InventoryPendingResponse>(
    () => apiFetch(`/api/dashboard/inventory-pending`),
    [],
  );

  // M: 画面（フィルタ適用）を開いた時点の総件数。
  const [initialTotal, setInitialTotal] = useState<number | null>(null);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [tierDrafts, setTierDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<ReadonlySet<string>>(new Set());

  const items = useMemo(
    () => (data?.items ?? []).filter((item) => !skipped.has(item.id)),
    [data, skipped],
  );

  if (data && initialTotal === null) {
    setInitialTotal(data.total);
  }
  const total = initialTotal ?? data?.total ?? 0;
  const remaining = items.filter((item) => !doneIds.has(item.id)).length;

  function changeFilter(kind: "category" | "location", value: string) {
    if (kind === "category") setCategory(value);
    else setLocation(value);
    // 古い data が残っている間に initialTotal を再計算しないよう、結果を先に空にする
    setData(null);
    setInitialTotal(null);
    setSkipped(new Set());
    setDoneIds(new Set());
    setTierDrafts({});
  }

  async function confirm(itemId: string) {
    setBusy(itemId);
    try {
      const tier = tierDrafts[itemId];
      await apiFetch(`/api/items/${itemId}/confirm`, {
        method: "POST",
        body: JSON.stringify(tier ? { necessityTier: tier } : {}),
      });
      setDoneIds((current) => new Set(current).add(itemId));
    } finally {
      setBusy(null);
    }
  }

  function skip(itemId: string) {
    setSkipped((current) => new Set(current).add(itemId));
  }

  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const item of unfiltered?.items ?? []) {
      if (item.location) set.add(item.location);
    }
    return [...set].sort();
  }, [unfiltered]);

  return (
    <div className="grid gap-4">
      <h1 className="text-lg font-semibold">棚卸し</h1>
      <div className="flex flex-wrap items-center gap-3">
        <Select aria-label="カテゴリ" value={category} onChange={(e) => changeFilter("category", e.target.value)}>
          <option value="">カテゴリ: すべて</option>
          {ITEM_CATEGORIES.map((c) => (
            <option key={c} value={c}>{ITEM_CATEGORY_LABELS[c as ItemCategoryValue]}</option>
          ))}
        </Select>
        <Select aria-label="保管場所" value={location} onChange={(e) => changeFilter("location", e.target.value)}>
          <option value="">保管場所: すべて</option>
          <option value="unset">未設定</option>
          {locations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
        </Select>
        <span className="text-sm text-ink-3">残り {remaining} / 全 {total}</span>
      </div>

      {loading ? <div className="text-sm text-ink-3">読み込み中…</div> : null}
      {error ? <div className="text-sm text-critical">{error}</div> : null}

      {items.filter((item) => !doneIds.has(item.id)).map((item) => (
        <Card key={item.id} className="grid gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-medium">{item.name}</div>
              <div className="text-xs text-ink-3">
                {ITEM_CATEGORY_LABELS[item.category as ItemCategoryValue] ?? item.category}
                {item.location ? ` · ${item.location}` : " · 場所未設定"}
                {` · 最終確認 ${formatDateWithYear(item.lastConfirmedOn)}`}
                {` · ${formatYen(item.purchasePrice)}`}
              </div>
            </div>
            {item.necessityTier ? (
              <StatusChip tone={item.necessityTier === "dormant" ? "warning" : "default"}>
                {NECESSITY_TIER_LABELS[item.necessityTier as NecessityTierValue]}
              </StatusChip>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="必要度"
              className="w-auto"
              value={tierDrafts[item.id] ?? item.necessityTier ?? ""}
              onChange={(e) => setTierDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
            >
              <option value="">必要度: 変更なし</option>
              {NECESSITY_TIERS.map((t) => (
                <option key={t} value={t}>{NECESSITY_TIER_LABELS[t as NecessityTierValue]}</option>
              ))}
            </Select>
            <Button variant="primary" disabled={busy === item.id} onClick={() => confirm(item.id)}>
              確認した
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/items/${item.id}?disposal=open`)}>手放した</Button>
            <Button variant="ghost" onClick={() => navigate(`/items/${item.id}`)}>編集</Button>
            <Button variant="ghost" onClick={() => skip(item.id)}>スキップ</Button>
          </div>
        </Card>
      ))}

      {data && remaining === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-3">棚卸し対象はすべて確認済みです。</Card>
      ) : null}
    </div>
  );
}
