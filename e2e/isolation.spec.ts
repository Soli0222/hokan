import { expect, test } from "./helpers/test";
import { startWorker } from "./helpers/worker";

// Exercise isolation even when the suite is intentionally run with one worker.
test("keeps another worker's data and session when one environment is destroyed", async ({
  page, playwright, environment,
}, testInfo) => {
  const probe = await startWorker(1_000_000 + testInfo.workerIndex);
  const other = await playwright.request.newContext({ baseURL: probe.baseURL });
  try {
    expect(probe.baseURL).not.toBe(environment.baseURL);
    expect(probe.databaseUrl).not.toBe(environment.databaseUrl);
    await other.get("/api/auth/login");
    for (const request of [page.request, other]) {
      const created = await request.post("/api/items", {
        data: { name: "Isolated item", category: "other", acquiredOn: "2026-01-10", purchasePrice: 1000 },
      });
      expect(created.ok()).toBe(true);
      const items = await request.get("/api/items");
      expect((await items.json()).items).toHaveLength(1);
    }
    await other.post("/api/auth/logout");
    await other.dispose();
    await probe.stop();
    const items = await page.request.get("/api/items");
    expect(items.status()).toBe(200);
    expect((await items.json()).items).toHaveLength(1);
  } finally {
    await other.dispose();
    await probe.stop();
  }
});
