import type {
  ItemDetailResponse,
  ItemCategoryValue,
  NecessityTierValue,
  AcquisitionTypeValue,
  ItemConditionValue,
  DisposalMethodValue,
  DisposalReasonValue,
  ValuationLiquidityValue,
} from "@hokan/shared";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { FormField } from "../components/ui/form-field";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { StatusChip } from "../components/ui/status-chip";
import { TableWrapper, Table } from "../components/ui/table";
import { useResource } from "../hooks/use-resource";
import { apiFetch } from "../lib/api";
import { formatDateWithYear, formatYen, parseYenInput } from "../lib/format";
import { todayDateString } from "../lib/dates";
import {
  ACQUISITION_TYPES,
  ACQUISITION_TYPE_LABELS,
  DISPOSAL_METHODS,
  DISPOSAL_METHOD_LABELS,
  DISPOSAL_REASONS,
  DISPOSAL_REASON_LABELS,
  ITEM_CATEGORIES,
  ITEM_CATEGORY_LABELS,
  ITEM_CONDITIONS,
  ITEM_CONDITION_LABELS,
  NECESSITY_TIERS,
  NECESSITY_TIER_LABELS,
  VALUATION_LIQUIDITIES,
  VALUATION_LIQUIDITY_LABELS,
} from "@hokan/shared";

type Draft = {
  name: string;
  category: string;
  maker: string;
  model: string;
  acquiredOn: string;
  acquiredOnApprox: boolean;
  acquisitionType: string;
  purchasePrice: string;
  purchaseSource: string;
  conditionAtAcquisition: string;
  quantity: string;
  purpose: string;
  location: string;
  necessityTier: string;
  notes: string;
};

function toDraft(detail: ItemDetailResponse): Draft {
  const item = detail.item;
  return {
    name: item.name,
    category: item.category,
    maker: item.maker ?? "",
    model: item.model ?? "",
    acquiredOn: item.acquiredOn ?? "",
    acquiredOnApprox: item.acquiredOnApprox,
    acquisitionType: item.acquisitionType ?? "",
    purchasePrice: item.purchasePrice === null ? "" : String(item.purchasePrice),
    purchaseSource: item.purchaseSource ?? "",
    conditionAtAcquisition: item.conditionAtAcquisition ?? "",
    quantity: String(item.quantity),
    purpose: item.purpose ?? "",
    location: item.location ?? "",
    necessityTier: item.necessityTier ?? "",
    notes: item.notes ?? "",
  };
}

// 前回同期から変更していないフィールドは新しい値、変更済みのフィールドは入力中の値を残す。
function mergeEdited(current: Draft, base: Draft, next: Draft): Draft {
  return Object.fromEntries(
    (Object.keys(next) as Array<keyof Draft>).map((key) => [
      key,
      current[key] === base[key] ? next[key] : current[key],
    ]),
  ) as Draft;
}

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [version, setVersion] = useState(0);
  const { data, loading, error } = useResource<ItemDetailResponse>(
    () => apiFetch(`/api/items/${id}`),
    [id, version],
  );

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [disposalOpen, setDisposalOpen] = useState(searchParams.get("disposal") === "open");
  const [valuationOpen, setValuationOpen] = useState(false);

  // 評価追加や確認操作での再取得で編集中の入力を消さないため、前回同期時点から
  // 編集していないフィールドだけ新しい値に差し替える。別物品へ移動したときは
  // 前の物品の編集を持ち越さない。
  const [syncedData, setSyncedData] = useState(data);
  const [syncedDraft, setSyncedDraft] = useState<Draft | null>(null);
  const [syncedId, setSyncedId] = useState(id);
  if (id !== syncedId) {
    setSyncedId(id);
    setSyncedDraft(null);
  }
  if (data !== syncedData) {
    setSyncedData(data);
    if (data) {
      const next = toDraft(data);
      setSyncedDraft(next);
      setDraft((current) =>
        current && syncedDraft && id === syncedId ? mergeEdited(current, syncedDraft, next) : next,
      );
    }
  }

  if (loading && !data) return <div className="p-6 text-sm text-ink-3">読み込み中…</div>;
  if (error || !data || !draft) return <div className="p-6 text-sm text-critical">{error ?? "取得に失敗しました"}</div>;

  const item = data.item;
  const metrics = item.metrics;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    try {
      const price = parseYenInput(draft.purchasePrice);
      if (Number.isNaN(price)) throw new Error("取得価格は0以上の整数で入力してください");
      const quantity = Number(draft.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error("数量は1以上の整数で入力してください");
      await apiFetch(`/api/items/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: draft.name.trim(),
          category: draft.category,
          maker: draft.maker || null,
          model: draft.model || null,
          acquiredOn: draft.acquiredOn || null,
          acquiredOnApprox: draft.acquiredOnApprox,
          acquisitionType: draft.acquisitionType || null,
          purchasePrice: price,
          purchaseSource: draft.purchaseSource || null,
          conditionAtAcquisition: draft.conditionAtAcquisition || null,
          quantity,
          purpose: draft.purpose || null,
          location: draft.location || null,
          necessityTier: draft.necessityTier || null,
          notes: draft.notes || null,
        }),
      });
      setVersion((v) => v + 1);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    await apiFetch(`/api/items/${item.id}`, { method: "DELETE" });
    navigate("/items");
  }

  async function confirmSeen() {
    await apiFetch(`/api/items/${item.id}/confirm`, { method: "POST", body: JSON.stringify({}) });
    setVersion((v) => v + 1);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="truncate text-lg font-semibold">{item.name}</h1>
        <div className="flex items-center gap-2">
          <StatusChip tone={item.status === "owned" ? "success" : "default"}>
            {item.status === "owned" ? "保有中" : "処分済み"}
          </StatusChip>
          {item.status === "owned" ? (
            <Button variant="secondary" onClick={confirmSeen}>確認した</Button>
          ) : null}
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>削除</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-3"><div className="text-xs text-ink-3">保有期間</div><div className="font-data text-lg">{metrics.holdingDays === null ? "—" : `${metrics.holdingDays} 日`}</div></Card>
        <Card className="p-3"><div className="text-xs text-ink-3">実質コスト</div><div className="font-data text-lg">{formatYen(metrics.effectiveCost)}</div></Card>
        <Card className="p-3"><div className="text-xs text-ink-3">月あたりコスト</div><div className="font-data text-lg">{formatYen(metrics.monthlyCost)}</div></Card>
        <Card className="p-3"><div className="text-xs text-ink-3">回収率</div><div className="font-data text-lg">{metrics.recoveryRate === null ? "—" : `${Math.round(metrics.recoveryRate * 100)}%`}</div></Card>
      </div>

      <Card className="grid gap-3 p-4">
        <h2 className="text-sm font-semibold">物品情報</h2>
        {formError ? <div className="text-sm text-critical">{formError}</div> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="物品名" required><Input value={draft.name} onChange={(e) => set("name", e.target.value)} /></FormField>
          <FormField label="カテゴリ" required>
            <Select value={draft.category} onChange={(e) => set("category", e.target.value)}>
              {ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{ITEM_CATEGORY_LABELS[c as ItemCategoryValue]}</option>)}
            </Select>
          </FormField>
          <FormField label="取得日" required help={draft.acquiredOnApprox ? "概算" : undefined}>
            <div className="flex items-center gap-2">
              <Input type="date" value={draft.acquiredOn} onChange={(e) => set("acquiredOn", e.target.value)} />
              <label className="flex items-center gap-1 text-xs text-ink-3">
                <input type="checkbox" checked={draft.acquiredOnApprox} onChange={(e) => set("acquiredOnApprox", e.target.checked)} />概算
              </label>
            </div>
          </FormField>
          <FormField label="取得価格（円）" required>
            <Input inputMode="numeric" value={draft.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} />
          </FormField>
          <FormField label="メーカー"><Input value={draft.maker} onChange={(e) => set("maker", e.target.value)} /></FormField>
          <FormField label="型番"><Input value={draft.model} onChange={(e) => set("model", e.target.value)} /></FormField>
          <FormField label="入手区分">
            <Select value={draft.acquisitionType} onChange={(e) => set("acquisitionType", e.target.value)}>
              <option value="">未設定</option>
              {ACQUISITION_TYPES.map((t) => <option key={t} value={t}>{ACQUISITION_TYPE_LABELS[t as AcquisitionTypeValue]}</option>)}
            </Select>
          </FormField>
          <FormField label="購入先"><Input value={draft.purchaseSource} onChange={(e) => set("purchaseSource", e.target.value)} /></FormField>
          <FormField label="取得時状態">
            <Select value={draft.conditionAtAcquisition} onChange={(e) => set("conditionAtAcquisition", e.target.value)}>
              <option value="">未設定</option>
              {ITEM_CONDITIONS.map((c) => <option key={c} value={c}>{ITEM_CONDITION_LABELS[c as ItemConditionValue]}</option>)}
            </Select>
          </FormField>
          <FormField label="数量"><Input inputMode="numeric" value={draft.quantity} onChange={(e) => set("quantity", e.target.value)} /></FormField>
          <FormField label="用途"><Input value={draft.purpose} onChange={(e) => set("purpose", e.target.value)} /></FormField>
          <FormField label="保管場所"><Input value={draft.location} onChange={(e) => set("location", e.target.value)} /></FormField>
          <FormField label="必要度">
            <Select value={draft.necessityTier} onChange={(e) => set("necessityTier", e.target.value)}>
              <option value="">未設定</option>
              {NECESSITY_TIERS.map((t) => <option key={t} value={t}>{NECESSITY_TIER_LABELS[t as NecessityTierValue]}</option>)}
            </Select>
          </FormField>
          <FormField label="メモ" className="sm:col-span-2"><Input value={draft.notes} onChange={(e) => set("notes", e.target.value)} /></FormField>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
          <span className="text-xs text-ink-3">最終確認: {formatDateWithYear(item.lastConfirmedOn)}</span>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">処分</h2>
          {item.status === "owned" || data.disposal ? (
            <Button variant="secondary" onClick={() => setDisposalOpen(true)}>
              {data.disposal ? "処分を修正" : "手放した"}
            </Button>
          ) : null}
        </div>
        {data.disposal ? (
          <div className="mt-3 text-sm">
            <div>手放した日: {formatDateWithYear(data.disposal.disposedOn)} ／ 方法: {DISPOSAL_METHOD_LABELS[data.disposal.method as DisposalMethodValue] ?? data.disposal.method} ／ 額: {formatYen(data.disposal.amount)}</div>
            <div className="text-xs text-ink-3">
              {[data.disposal.channel, data.disposal.reason ? DISPOSAL_REASON_LABELS[data.disposal.reason as DisposalReasonValue] : null, data.disposal.notes].filter(Boolean).join(" · ")}
            </div>
            <Button
              variant="ghost"
              className="mt-2"
              onClick={async () => {
                await apiFetch(`/api/items/${item.id}/disposal`, { method: "DELETE" });
                setVersion((v) => v + 1);
              }}
            >処分を取り消す（保有中に戻す）</Button>
          </div>
        ) : (
          <div className="mt-2 text-sm text-ink-3">処分は登録されていません。</div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">評価履歴</h2>
          <Button variant="secondary" onClick={() => setValuationOpen(true)}>評価を追加</Button>
        </div>
        <TableWrapper className="mt-3">
          <Table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <th className="py-1 pr-4">評価日</th>
                <th className="py-1 pr-4 text-right">見込み額</th>
                <th className="py-1 pr-4">流動性</th>
                <th className="py-1 pr-4">根拠</th>
                <th className="py-1">登録者</th>
              </tr>
            </thead>
            <tbody>
              {data.valuations.map((v) => (
                <tr key={v.id} className="border-t border-line">
                  <td className="py-2 pr-4">{formatDateWithYear(v.estimatedOn)}</td>
                  <td className="font-data py-2 pr-4 text-right">{formatYen(v.estimatedResalePrice)}</td>
                  <td className="py-2 pr-4">{v.liquidity ? VALUATION_LIQUIDITY_LABELS[v.liquidity as ValuationLiquidityValue] : "—"}</td>
                  <td className="py-2 pr-4">{v.source ?? "—"}</td>
                  <td className="py-2">{v.estimatedBy === "ai" ? "AI" : "本人"}</td>
                </tr>
              ))}
              {data.valuations.length === 0 ? (
                <tr><td className="py-4 text-sm text-ink-3" colSpan={5}>評価はまだありません。</td></tr>
              ) : null}
            </tbody>
          </Table>
        </TableWrapper>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="物品を削除する"
        description={`「${item.name}」と関連する処分・評価をすべて削除します。この操作は元に戻せません。`}
        onConfirm={remove}
      />
      {disposalOpen ? (
        <DisposalEditor
          onOpenChange={setDisposalOpen}
          itemId={item.id}
          existing={data.disposal}
          onSaved={() => setVersion((v) => v + 1)}
        />
      ) : null}
      {valuationOpen ? (
        <ValuationEditor
          onOpenChange={setValuationOpen}
          itemId={item.id}
          onSaved={() => setVersion((v) => v + 1)}
        />
      ) : null}
    </div>
  );
}

function DisposalEditor({
  onOpenChange, itemId, existing, onSaved,
}: {
  onOpenChange: (open: boolean) => void;
  itemId: string;
  existing: ItemDetailResponse["disposal"];
  onSaved: () => void;
}) {
  const [disposedOn, setDisposedOn] = useState(existing?.disposedOn ?? todayDateString());
  const [method, setMethod] = useState<DisposalMethodValue>(existing?.method ?? "sale");
  const [amount, setAmount] = useState(existing?.amount == null ? "" : String(existing?.amount));
  const [channel, setChannel] = useState(existing?.channel ?? "");
  const [reason, setReason] = useState<DisposalReasonValue | "">(existing?.reason ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const parsed = amount === "" ? null : parseYenInput(amount);
    if (amount !== "" && (parsed === null || Number.isNaN(parsed))) { setError("額は0以上の整数で入力してください"); return; }
    try {
      await apiFetch(`/api/items/${itemId}/disposal`, {
        method: "PUT",
        body: JSON.stringify({
          disposedOn,
          method,
          amount: parsed ?? null,
          channel: channel || null,
          reason: reason || null,
          notes: notes || null,
        }),
      });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    }
  }

  return (
    <Card className="fixed inset-x-3 bottom-24 z-50 grid gap-3 p-4 shadow-[var(--elev-1)] sm:inset-x-auto sm:right-6 sm:w-96">
      <h3 className="text-sm font-semibold">{existing ? "処分を修正" : "手放した"}</h3>
      {error ? <div className="text-xs text-critical">{error}</div> : null}
      <FormField label="手放した日" required><Input type="date" value={disposedOn} onChange={(e) => setDisposedOn(e.target.value)} /></FormField>
      <FormField label="方法" required>
        <Select value={method} onChange={(e) => setMethod(e.target.value as DisposalMethodValue)}>
          {DISPOSAL_METHODS.map((m) => <option key={m} value={m}>{DISPOSAL_METHOD_LABELS[m as DisposalMethodValue]}</option>)}
        </Select>
      </FormField>
      <FormField label="額（円）"><Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></FormField>
      <FormField label="経路"><Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="メルカリ 等" /></FormField>
      <FormField label="理由">
        <Select value={reason} onChange={(e) => setReason(e.target.value as DisposalReasonValue | "")}>
          <option value="">未設定</option>
          {DISPOSAL_REASONS.map((r) => <option key={r} value={r}>{DISPOSAL_REASON_LABELS[r as DisposalReasonValue]}</option>)}
        </Select>
      </FormField>
      <FormField label="メモ"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>キャンセル</Button>
        <Button onClick={save}>保存</Button>
      </div>
    </Card>
  );
}

function ValuationEditor({
  onOpenChange, itemId, onSaved,
}: {
  onOpenChange: (open: boolean) => void;
  itemId: string;
  onSaved: () => void;
}) {
  const [price, setPrice] = useState("");
  const [estimatedOn, setEstimatedOn] = useState(todayDateString());
  const [liquidity, setLiquidity] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const parsed = parseYenInput(price);
    if (parsed === null || Number.isNaN(parsed)) { setError("見込み額は0以上の整数で入力してください"); return; }
    try {
      await apiFetch(`/api/items/${itemId}/valuations`, {
        method: "POST",
        body: JSON.stringify({
          estimatedResalePrice: parsed,
          estimatedOn,
          liquidity: liquidity || null,
          source: source || null,
        }),
      });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    }
  }

  return (
    <Card className="fixed inset-x-3 bottom-24 z-50 grid gap-3 p-4 shadow-[var(--elev-1)] sm:inset-x-auto sm:right-6 sm:w-96">
      <h3 className="text-sm font-semibold">評価を追加</h3>
      {error ? <div className="text-xs text-critical">{error}</div> : null}
      <FormField label="見込み売却額（円）" required><Input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} /></FormField>
      <FormField label="評価日"><Input type="date" value={estimatedOn} onChange={(e) => setEstimatedOn(e.target.value)} /></FormField>
      <FormField label="流動性">
        <Select value={liquidity} onChange={(e) => setLiquidity(e.target.value)}>
          <option value="">未設定</option>
          {VALUATION_LIQUIDITIES.map((l) => <option key={l} value={l}>{VALUATION_LIQUIDITY_LABELS[l as ValuationLiquidityValue]}</option>)}
        </Select>
      </FormField>
      <FormField label="根拠"><Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="相場 URL 等" /></FormField>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>キャンセル</Button>
        <Button onClick={save}>保存</Button>
      </div>
    </Card>
  );
}
