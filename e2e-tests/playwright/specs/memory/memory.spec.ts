import { expect, test } from "../../fixtures.ts";
import { MemoryPage } from "../../pages/memory_page.ts";
import { SessionReplayOverviewPage } from "../../pages/session_replay_overview_page.ts";
import { SessionReplayPage } from "../../pages/session_replay_page.ts";

// The memory Maestro flow tags its session with this user id.
const USER_ID = "session_timeline_test_user";

const PERCENTILES = ["p50", "p90", "p95"] as const;
const MEMORY_VALUE = /^\d+(\.\d+)? (MB|GB)$/;

test.describe("memory", () => {
  let memory: MemoryPage;

  test.beforeEach(async ({ page, appId, teamId }) => {
    memory = new MemoryPage(page, teamId);
    await memory.goto(appId);
  });

  test("memory usage plot renders the collected samples", async () => {
    await expect(memory.plot).toBeVisible();
    await expect(memory.plotNoData).not.toBeVisible();
  });

  test("memory usage plot renders at every percentile", async () => {
    for (const percentile of [...PERCENTILES, "p99"]) {
      await memory.selectPercentile(percentile);
      await expect(memory.plot).toBeVisible();
      await expect(memory.plotNoData).not.toBeVisible();
    }
  });

  test("breakdown is keyed by device total memory", async () => {
    await expect(
      memory.selectBreakdownHeader("Device total memory"),
    ).toBeVisible();
  });

  test("breakdown renders a device memory tier with its percentiles", async () => {
    const row = memory.breakdownRow.first();
    await expect(row).toBeVisible();
    await expect(memory.breakdownNoData).not.toBeVisible();
    for (const percentile of PERCENTILES) {
      await expect(
        memory.selectBreakdownPercentile(row, percentile),
      ).toHaveText(MEMORY_VALUE);
    }
  });

  // The frank flows stay far below the high usage threshold, so this only
  // checks that the section loads.
  test("high memory usage sessions renders its table", async () => {
    await expect(memory.highMemorySessions).toContainText(
      "Sessions with high memory usage",
    );
  });

  test("session replay renders the memory chart", async ({
    page,
    appId,
    teamId,
  }) => {
    const overview = new SessionReplayOverviewPage(page, teamId);
    await overview.goto(appId, `user_id:in:${USER_ID}`);
    await expect(overview.sessionRow.first()).toBeVisible();
    await overview.openSession();

    const replay = new SessionReplayPage(page, teamId);
    await expect(replay.eventsList).toBeVisible();
    await expect(replay.selectMetricChart("Memory")).toBeVisible();
  });

  test.describe("android", { tag: "@android" }, () => {
    test("memory usage plot renders background samples", async ({ appId }) => {
      await memory.goto(appId, "app_state:eq:background");
      await expect(memory.plot).toBeVisible();
      await expect(memory.plotNoData).not.toBeVisible();
    });
  });
});
