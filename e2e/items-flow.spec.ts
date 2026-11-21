import { expect, test } from "./helpers/test";
import { navigateTo } from "./helpers/actions";
import { getDate } from "./helpers/scenario";

// 主要フロー: 物品登録 → 評価追加 → 処分登録 → ダッシュボード反映。
test("item registration, valuation, disposal and dashboard reflection", async ({ page }) => {
  const openedAt = new Date();

  await navigateTo(page, "/items/new");
  await page.getByLabel(/物品名/).fill("E2E キーボード");
  await page.getByLabel("カテゴリ").selectOption("pc_peripheral");
  await page.getByLabel(/取得価格/).fill("12000");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/\/items\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "E2E キーボード" })).toBeVisible();

  // 評価を追加（オーバーレイ内の保存ボタンを指定）
  await page.getByRole("button", { name: "評価を追加" }).click();
  const valuationCard = page.locator("h3", { hasText: "評価を追加" }).locator("..");
  await valuationCard.getByLabel(/見込み売却額/).fill("8000");
  await valuationCard.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("8,000").first()).toBeVisible();

  // 手放した（処分登録）
  await page.getByRole("button", { name: "手放した" }).click();
  const disposalCard = page.locator("h3", { hasText: "手放した" }).locator("..");
  await disposalCard.getByLabel("手放した日").fill(getDate());
  await disposalCard.getByLabel("方法").selectOption("sale");
  await disposalCard.getByLabel(/額（円）/).fill("9000");
  await disposalCard.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("処分済み")).toBeVisible();

  // ダッシュボード: 保有中に残っていないことを確認
  await navigateTo(page, "/");
  await expect(page.getByText("保有中", { exact: true })).toBeVisible();
  await expect(page.getByText("0 件").first()).toBeVisible();

  void openedAt;
});
