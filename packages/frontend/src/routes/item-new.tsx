import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { FormField } from "../components/ui/form-field";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { apiFetch } from "../lib/api";
import { parseYenInput } from "../lib/format";
import { todayDateString } from "../lib/dates";
import type { ItemDetailResponse } from "@hokan/shared";
import {
  ACQUISITION_TYPES,
  ACQUISITION_TYPE_LABELS,
  ITEM_CATEGORIES,
  ITEM_CATEGORY_LABELS,
  ITEM_CONDITIONS,
  ITEM_CONDITION_LABELS,
  NECESSITY_TIERS,
  NECESSITY_TIER_LABELS,
  type AcquisitionTypeValue,
  type ItemCategoryValue,
  type ItemConditionValue,
  type NecessityTierValue,
} from "@hokan/shared";

export function ItemNewPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("pc_peripheral");
  const [acquiredOn, setAcquiredOn] = useState(todayDateString());
  const [price, setPrice] = useState("");
  const [approx, setApprox] = useState(false);
  const [maker, setMaker] = useState("");
  const [model, setModel] = useState("");
  const [acquisitionType, setAcquisitionType] = useState("");
  const [source, setSource] = useState("");
  const [condition, setCondition] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [purpose, setPurpose] = useState("");
  const [location, setLocation] = useState("");
  const [tier, setTier] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = parseYenInput(price);
    if (!name.trim()) { setError("物品名は必須です"); return; }
    if (parsed === null || Number.isNaN(parsed)) { setError("取得価格は0以上の整数で入力してください"); return; }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) { setError("数量は1以上の整数で入力してください"); return; }
    setSaving(true);
    try {
      const created = await apiFetch<ItemDetailResponse>("/api/items", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          category,
          acquiredOn: acquiredOn || null,
          acquiredOnApprox: approx,
          purchasePrice: parsed,
          maker: maker || null,
          model: model || null,
          acquisitionType: acquisitionType || null,
          purchaseSource: source || null,
          conditionAtAcquisition: condition || null,
          quantity: qty,
          purpose: purpose || null,
          location: location || null,
          necessityTier: tier || null,
          notes: notes || null,
        }),
      });
      navigate(`/items/${created.item.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-lg font-semibold">物品を登録</h1>
      <form onSubmit={submit} className="grid gap-4">
        <Card className="grid gap-3 p-4">
          <h2 className="text-sm font-semibold">必須項目</h2>
          {error ? <div className="text-sm text-critical">{error}</div> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="物品名" required><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></FormField>
            <FormField label="カテゴリ" required>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{ITEM_CATEGORY_LABELS[c as ItemCategoryValue]}</option>)}
              </Select>
            </FormField>
            <FormField label="取得日" required help="既定は当日。概算ならチェックを付ける">
              <div className="flex items-center gap-2">
                <Input type="date" value={acquiredOn} onChange={(e) => setAcquiredOn(e.target.value)} />
                <label className="flex items-center gap-1 text-xs text-ink-3">
                  <input type="checkbox" checked={approx} onChange={(e) => setApprox(e.target.checked)} />概算
                </label>
              </div>
            </FormField>
            <FormField label="取得価格（円）" required>
              <Input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="12000" />
            </FormField>
          </div>
        </Card>

        <Card className="grid gap-3 p-4">
          <h2 className="text-sm font-semibold">任意項目</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="メーカー"><Input value={maker} onChange={(e) => setMaker(e.target.value)} /></FormField>
            <FormField label="型番"><Input value={model} onChange={(e) => setModel(e.target.value)} /></FormField>
            <FormField label="入手区分">
              <Select value={acquisitionType} onChange={(e) => setAcquisitionType(e.target.value)}>
                <option value="">未設定</option>
                {ACQUISITION_TYPES.map((t) => <option key={t} value={t}>{ACQUISITION_TYPE_LABELS[t as AcquisitionTypeValue]}</option>)}
              </Select>
            </FormField>
            <FormField label="購入先"><Input value={source} onChange={(e) => setSource(e.target.value)} /></FormField>
            <FormField label="取得時状態">
              <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
                <option value="">未設定</option>
                {ITEM_CONDITIONS.map((c) => <option key={c} value={c}>{ITEM_CONDITION_LABELS[c as ItemConditionValue]}</option>)}
              </Select>
            </FormField>
            <FormField label="数量" help="数量が 2 以上の物品は一部だけ手放せません。分ける場合は別レコードに分割します">
              <Input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </FormField>
            <FormField label="用途"><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} /></FormField>
            <FormField label="保管場所"><Input value={location} onChange={(e) => setLocation(e.target.value)} /></FormField>
            <FormField label="必要度">
              <Select value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="">未設定</option>
                {NECESSITY_TIERS.map((t) => <option key={t} value={t}>{NECESSITY_TIER_LABELS[t as NecessityTierValue]}</option>)}
              </Select>
            </FormField>
            <FormField label="メモ"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
          </div>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>{saving ? "登録中…" : "登録する"}</Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/items")}>キャンセル</Button>
        </div>
      </form>
    </div>
  );
}
