import { expect, test } from "../../fixtures.ts";
import { SessionTimelinesOverviewPage } from "../../pages/session_timelines_overview_page.ts";
import { SessionTimelinePage } from "../../pages/session_timeline_page.ts";

// The session_timeline Maestro flow tags one session per platform with this id.
const USER_ID = "session_timeline_test_user";

test.describe("session timelines search", () => {
  let overview: SessionTimelinesOverviewPage;

  test.beforeEach(async ({ page, appId, teamId }) => {
    overview = new SessionTimelinesOverviewPage(page, teamId);
    await overview.goto(appId);
    await overview.search(USER_ID);
    await expect(overview.sessionRow.first()).toBeVisible();
  });

  test("searching by user id returns the tagged session and opens it", async ({
    page,
    appId,
    teamId,
  }) => {
    await expect(overview.sessionRow.first()).toBeVisible();

    const href = await overview.sessionRow.first().getAttribute("href");
    const sessionId = href!.split("/").pop()!;

    await overview.openSession();
    await page.waitForURL(
      `**/${teamId}/session_timelines/${appId}/${sessionId}`,
    );

    const timeline = new SessionTimelinePage(page, teamId);
    await expect(timeline.userIdHeader(USER_ID)).toBeVisible();
  });

  test("searching by event type lists matching sessions", async () => {
    await overview.search("gesture_click");
    await expect(overview.sessionRow.first()).toBeVisible();
    await expect(overview.matchedBadge.first()).toContainText("gesture_click");
  });

  test("session type filter narrows to the tagged session", async () => {
    await overview.filterBySessionType("Handled Error Sessions");
    await expect(overview.sessionRow.first()).toBeVisible();
  });

  test("session type filter excludes the tagged session", async () => {
    // The tagged session has no ANR, so combining its user id with the ANR
    // session type yields nothing.
    await overview.filterBySessionType("ANR Sessions");
    await expect(overview.sessionRow.first()).not.toBeVisible();
  });

  test.describe("android", { tag: "@android" }, () => {
    test("searching by exception trace lists matching sessions", async () => {
      // Frank's "Track Handled Exception" throws a chained IOException.
      await overview.search("IOException");
      await expect(overview.sessionRow.first()).toBeVisible();
    });
  });
});
