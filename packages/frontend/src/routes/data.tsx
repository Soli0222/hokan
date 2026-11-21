import type { DataExportPayload, ImportResult } from "@hokan/shared";
import { useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { apiFetch } from "../lib/api";

export function DataManagementPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<DataExportPayload | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function doExport() {
    setBusy(true);
    setMessage(null);
    try {
      const exported = await apiFetch<DataExportPayload>("/api/export");
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `hokan-export-${exported.exportedAt.slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(`${exported.data.items.length} 件の物品を書き出しました。`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "書き出しに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function onFileSelected(file: File) {
    setMessage(null);
    try {
      const parsed = JSON.parse(await file.text()) as DataExportPayload;
      if (parsed.formatVersion !== 1 || !parsed.data?.items) {
        throw new Error("hokan のエクスポート形式ではありません");
      }
      setPendingPayload(parsed);
      setConfirmOpen(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "ファイルを読めませんでした");
    }
  }

  async function doImport() {
    if (!pendingPayload) return;
    setBusy(true);
    try {
      const result = await apiFetch<ImportResult>("/api/import", {
        method: "POST",
        body: JSON.stringify({ formatVersion: 1, mode: "replace", data: pendingPayload.data }),
      });
      setMessage(`置き換えました: 物品 ${result.counts.items} / 処分 ${result.counts.disposals} / 評価 ${result.counts.valuations} 件`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setBusy(false);
      setPendingPayload(null);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-lg font-semibold">データ管理</h1>
      <Card className="grid gap-3 p-4">
        <h2 className="text-sm font-semibold">エクスポート</h2>
        <div className="text-sm text-ink-3">物品・処分・評価の全データを JSON で書き出します。</div>
        <div><Button variant="secondary" onClick={doExport} disabled={busy}>書き出す</Button></div>
      </Card>
      <Card className="grid gap-3 p-4">
        <h2 className="text-sm font-semibold">インポート（全置換）</h2>
        <div className="text-sm text-ink-3">エクスポート JSON で現在の全データを置き換えます。</div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFileSelected(file);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>ファイルを選ぶ</Button>
        </div>
      </Card>
      {message ? <div className="text-sm">{message}</div> : null}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="全データを置き換える"
        description={pendingPayload ? `${pendingPayload.data.items.length} 件の物品で現在の全データを置き換えます。この操作は元に戻せません。` : undefined}
        confirmLabel="置き換える"
        onConfirm={doImport}
      />
    </div>
  );
}
