import { expect, type Locator, type Page } from "@playwright/test";
import { getCurrentDates } from "./scenario";

export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("main")).toBeVisible();
}

export async function expectCurrentDate(input: Locator, openedAt: Date) {
  await expect(input).toBeVisible();
  await expect(input).toHaveValue(new RegExp(`^(?:${getCurrentDates(openedAt).join("|")})$`));
}

export async function expectTableRowCount(scope: Locator, count: number) {
  await expect(scope.locator("tbody tr")).toHaveCount(count);
}

export async function waitForReload(page: Page) {
  await page.waitForTimeout(150);
}
