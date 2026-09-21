import { expect, test } from "../../fixtures.ts";
import { SessionReplayOverviewPage } from "../../pages/session_replay_overview_page.ts";
import { SessionReplayPage } from "../../pages/session_replay_page.ts";

// The session_timeline Maestro flow tags one session per platform with this id.
const USER_ID = "session_timeline_test_user";
const USER_FILTER = `user_id:in:${USER_ID}`;

test.describe("session replay search", () => {
  let overview: SessionReplayOverviewPage;

  test.beforeEach(async ({ page, appId, teamId }) => {
    overview = new SessionReplayOverviewPage(page, teamId);
    await overview.goto(appId);
    await overview.filter(USER_FILTER);
    await expect(overview.sessionRow.first()).toBeVisible();
  });

  test("filtering by user id returns the tagged session and opens it", async ({
    page,
    appId,
    teamId,
  }) => {
    const href = await overview.sessionRow.first().getAttribute("href");
    const sessionId = href!.split("/").pop()!;

    await overview.openSession();
    await page.waitForURL(`**/${teamId}/session_replays/${appId}/${sessionId}`);

    const replay = new SessionReplayPage(page, teamId);
    await expect(replay.userIdHeader(USER_ID)).toBeVisible();
  });

  test("event kind filter keeps the tagged session", async () => {
    await overview.filter(
      `${USER_FILTER} AND session_events:in:user_interaction`,
    );
    await expect(overview.sessionRow.first()).toBeVisible();
  });

  test("error kind filter narrows to the tagged session", async () => {
    await overview.filter(`${USER_FILTER} AND session_events:in:handled_error`);
    await expect(overview.sessionRow.first()).toBeVisible();
  });

  test("error kind filter excludes the tagged session", async () => {
    // The tagged session has no ANR, so combining its user id with the ANR
    // event kind yields nothing.
    await overview.filter(`${USER_FILTER} AND session_events:in:anr`);
    await expect(overview.sessionRow.first()).not.toBeVisible();
  });

  test.describe("android", { tag: "@android" }, () => {
    test("error text filter lists matching sessions", async () => {
      // Frank's "Track Handled Exception" throws a chained IOException.
      await overview.filter("session_error_text:contains:IOException");
      await expect(overview.sessionRow.first()).toBeVisible();
    });
  });
});
