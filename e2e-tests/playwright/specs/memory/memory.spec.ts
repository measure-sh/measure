import { expect, test } from "../../fixtures.ts";
import { MemoryPage, ramTierLabelToFilterValue } from "../../pages/memory_page.ts";

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

    test("filtering by the session's own RAM Tier still renders the ranking", async ({
      appId,
    }) => {
      // Regression test: a session_ram_tier filter used to make
      // GetHighestMemorySessions 500 (an alias in its query shadowed the
      // column the filter's WHERE clause referenced) — caught live, not by
      // any test, because nothing here had exercised the RAM Tier filter
      // against the ranked-sessions endpoint before.
      await expect(memory.sessionRow.first()).toBeVisible({ timeout: 20_000 });
      const ramTierLabel = await memory.sessionRamTier.first().innerText();
      const ramTierValue = ramTierLabelToFilterValue(ramTierLabel);

      await memory.gotoFilteredByRamTier(appId, ramTierValue);

      await expect(memory.sessionsSection).not.toContainText(
        "Error fetching sessions",
      );
      await expect(memory.sessionRow.first()).toBeVisible({ timeout: 20_000 });
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
