import { expect, test } from "../../fixtures.ts";
import { MemoryPage } from "../../pages/memory_page.ts";

test.describe("memory monitoring", () => {
  let memory: MemoryPage;

  test.beforeEach(async ({ page, appId, teamId }) => {
    memory = new MemoryPage(page, teamId);
    await memory.goto(appId);
  });

  test.describe("android", { tag: "@android" }, () => {
    test("renders the trend and at least one ranked session for the flow's session", async () => {
      await expect(memory.trendSection).toBeVisible();
      await expect(memory.trendSection).toContainText(
        "Dynamic Memory Usage Trend",
      );

      await expect(memory.sessionsSection).toBeVisible();
      // The Maestro flow guarantees this session was sampled (100% via
      // enableFullMemorySampling) and backgrounded/foregrounded, so it has
      // at least one memory_usage_dynamic reading and shows up here.
      await expect(memory.sessionRow.first()).toBeVisible({ timeout: 20_000 });
      await expect(
        memory.sessionRow.first().getByText(/^\d+ MB$/),
      ).toBeVisible();
    });

    test("dashboard screenshot", async ({ page }) => {
      await expect(memory.sessionRow.first()).toBeVisible({ timeout: 20_000 });
      await page.screenshot({
        path: "test-results/memory-android.png",
        fullPage: true,
      });
    });
  });

  test.describe("ios", { tag: "@ios" }, () => {
    test("renders the trend and at least one ranked session for the flow's session", async () => {
      await expect(memory.trendSection).toBeVisible();
      await expect(memory.trendSection).toContainText(
        "Memory Footprint Trend",
      );

      await expect(memory.sessionsSection).toBeVisible();
      await expect(memory.sessionRow.first()).toBeVisible({ timeout: 20_000 });
      await expect(
        memory.sessionRow.first().getByText(/^\d+ MB$/),
      ).toBeVisible();
    });

    test("dashboard screenshot", async ({ page }) => {
      await expect(memory.sessionRow.first()).toBeVisible({ timeout: 20_000 });
      await page.screenshot({
        path: "test-results/memory-ios.png",
        fullPage: true,
      });
    });
  });
});
