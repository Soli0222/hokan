# AGENTS.md

## Project overview

資産管理台帳「hokan」。物品の取得・評価・保有・処分を記録し、保有コストや眠り資産、売却候補を把握するフルスタックアプリケーション。

## Design assumptions

- 金額は円の最小単位の整数とし、int32 を超える入力は 400 で拒否する。
- 集計値（保有期間・実質コスト・月あたりコスト・回収率・保有中合計・眠り資産・カテゴリ別集計・180日超過物品数）は保存せず、常に計算で出す。
- `quantity > 1` の物品は一部だけの処分を許さない。一部だけ手放す場合はレコードを数量ごとに分割する運用とする。
- 棚卸しセッションのエンティティは作らない。棚卸し対象は owned かつ未確認（lastConfirmedOn = NULL）または最終確認から180日超の物品のみ、lastConfirmedOn 古い順（NULL 先頭、同値は id 順）。
- `get_sell_candidates` は necessity_tier が sub/dormant の物品のみ対象とし、essential/main/未設定は候補外とする。
- 認証は外部 IdP（Keycloak）を使い、アプリ内に ID/PW を持たない。クライアント ID・スコープは環境変数で差し替え可能にする。認証無効化は信頼境界内に限る。

## Testing rules

**テストは必ず Makefile 経由で実行すること。** pnpm コマンドを直接実行してはならない。

| 種別 | コマンド |
|------|----------|
| ユニットテスト | `make test-unit` |
| インテグレーションテスト | `make test-integration` |
| E2Eテスト | `make test-e2e` |
| Lint | `make lint` |
| 型チェック | `make typecheck` |
| ビルド | `make build` |

### テストを書くとき

- 新規追加の前に既存ケースの拡張で足りるか確認する。E2E を追加する PR には実ブラウザが必要な理由を書く。同じ境界値を複数の層で網羅しない。
- 単体・結合では基準日を引数で渡すか `vi.setSystemTime` で時計を固定する。
- E2E の `test` は `e2e/helpers/test.ts` を使う。API・mock IdP・Playwright・ブラウザ・DBの時計は変更しない。
- E2E の日付は実際の実行日から作る。日付境界の期待値は単体・結合で検証する。
- 通常の `make test-e2e` を1回実行し、日付を変えた再実行やカレンダー別のCIを追加しない。
- worker fixture に専用 DB の初期化を任せ、spec で共通 DB をリセットしない。

結合・E2E・performance は隔離ランナーが DB の準備と終了処理を行う。手動で DB を準備しない。
異常終了時も他の slot のプロセス・コンテナ・ロックを操作しない。

## Code conventions

- 共有型は `packages/shared/src/types/` に定義する
- API レスポンス型は `api.ts`、ドメインモデルは `domain.ts`
- 日付と集計の計算は `@hokan/shared` に置く（フロントとバックで同じ規則を使うため）
- バックエンドのビジネスロジックは `packages/backend/src/services/` に配置
- ルートハンドラは zod での検証と入出力の整形に留める
- テストヘルパーは `packages/backend/src/test-helpers/` にある

## Key files

| ファイル | 役割 |
|----------|------|
| `packages/backend/src/services/items.ts` | 物品・処分・評価・集計の中核ロジック |
| `packages/shared/src/lib/item-metrics.ts` | 実質コスト・月あたりコスト・回収率・棚卸し順序の純粋関数 |
| `packages/backend/src/app.ts` | HTTP ルートとミドルウェアの登録 |
| `packages/backend/src/middleware/auth.ts` | 資格情報の検証と読み取り専用の強制 |
| `packages/backend/src/mcp/` | MCP サーバ実装（ツール・API parity・出力契約） |
| `packages/db/prisma/schema.prisma` | データモデル（Item / Disposal / Valuation） |
| `scripts/run-isolated-test.mjs` | スロット割り当て、DB 起動、テスト実行、停止を行うランナー |
| `playwright.config.ts` | E2E の並列数と実行別の成果物パス |
| `e2e/helpers/test.ts` | worker ごとの DB・API・mock IdP・認証とテスト前の初期化 |
