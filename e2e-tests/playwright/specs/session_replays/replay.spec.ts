import { expect, test } from "../../fixtures.ts";
import { SessionReplayOverviewPage } from "../../pages/session_replay_overview_page.ts";
import { SessionReplayPage } from "../../pages/session_replay_page.ts";

const USER_ID = "session_timeline_test_user";

async function expectEvent(
  replay: SessionReplayPage,
  type: string,
  pill: string,
) {
  const event = replay.selectEvent(type).first();
  await expect(event).toBeVisible();
  await expect(replay.selectEventPill(event, pill)).toBeVisible();
}

const LOG_SEVERITIES = ["Debug", "Info", "Warning", "Error", "Fatal"];

function selectLog(
  replay: SessionReplayPage,
  body: string,
  severity: string,
) {
  return replay
    .selectEvent("log", new RegExp(body))
    .filter({ hasText: `Log: ${severity}` })
    .first();
}

test.describe("session replay", () => {
  let replay: SessionReplayPage;

  test.beforeEach(async ({ page, appId, teamId }) => {
    const overview = new SessionReplayOverviewPage(page, teamId);
    await overview.goto(appId);
    await overview.search(USER_ID);
    await expect(overview.sessionRow.first()).toBeVisible();
    await overview.openSession();
    replay = new SessionReplayPage(page, teamId);
    await expect(replay.eventsList).toBeVisible();
  });

  test("header shows the tagged user id", async () => {
    await expect(replay.userIdHeader(USER_ID)).toBeVisible();
  });

  test("renders the cross-platform events", async () => {
    await expectEvent(replay, "gesture_click", "Click");
    await expectEvent(replay, "http", "HTTP");
    await expectEvent(replay, "custom", "Custom");
    await expectEvent(replay, "trace", "Trace");
    await expectEvent(replay, "lifecycle_app", "App");
    await expect(replay.selectEvent("log").first()).toBeVisible();
  });

  test("http event shows the method and opens details", async () => {
    const http = replay.selectEvent("http").first();
    await expect(http).toBeVisible();
    await expect(http).toContainText(/GET|POST|PUT|DELETE|PATCH|HEAD/);
    await http.click();
    await expect(replay.eventDetails).toBeVisible();
  });

  test("handled error event links to error details", async () => {
    const error = replay.selectError(/./).first();
    await expect(
      replay.selectEventPill(error, "Handled Error"),
    ).toBeVisible();
    await error.click();
    await replay.openErrorDetails();
  });

  test("trace event links to trace details", async () => {
    const trace = replay.selectEvent("trace").first();
    await trace.click();
    await replay.openTraceDetails();
  });

  test("trace event expands to show its trace fields", async () => {
    const trace = replay.selectEvent("trace").first();
    await trace.click();
    await expect(replay.eventDetails).toContainText("trace_id");
    await expect(replay.eventDetails).toContainText("trace_name");
  });

  // The maestro flows reach buttons with scrollUntilVisible, so the SDK
  // captures scroll gestures naturally without an explicit flow step.
  test("gesture scroll event expands to show its target", async () => {
    const scroll = replay.selectEvent("gesture_scroll").first();
    await expect(scroll).toBeVisible();
    await scroll.click();
    await expect(replay.eventDetails).toContainText("target");
  });

  test("lifecycle app event expands to show its type", async () => {
    const lifecycle = replay.selectEvent("lifecycle_app").first();
    await lifecycle.click();
    await expect(replay.eventDetails).toContainText(/foreground|background/);
  });

  test("react native manual logs render at every severity", async () => {
    for (const severity of LOG_SEVERITIES) {
      await expect(
        selectLog(replay, "manual log from react native", severity),
      ).toBeVisible();
    }
  });

  test("react native manual log expands to show its attributes", async () => {
    const log = selectLog(replay, "manual log from react native", "Warning");
    await log.click();
    await expect(replay.eventDetails).toContainText("retry_count");
  });

  test("react native automatically collected log renders", async () => {
    await expect(
      selectLog(replay, "console log from react native", "Info"),
    ).toBeVisible();
  });

  test("flutter manual logs render at every severity", async () => {
    for (const severity of LOG_SEVERITIES) {
      await expect(
        selectLog(replay, "manual log from flutter", severity),
      ).toBeVisible();
    }
  });

  test("flutter manual log expands to show its attributes", async () => {
    const log = selectLog(replay, "manual log from flutter", "Warning");
    await log.click();
    await expect(replay.eventDetails).toContainText("retry_count");
  });

  test("kmp manual logs render at every severity", async () => {
    for (const severity of LOG_SEVERITIES) {
      await expect(
        selectLog(replay, "manual log from kmp", severity),
      ).toBeVisible();
    }
  });

  test.describe("android", { tag: "@android" }, () => {
    test("renders the android-only events", async () => {
      await expectEvent(replay, "screen_view", "Screen View");
      await expectEvent(replay, "lifecycle_activity", "Activity");
      await expectEvent(replay, "network_change", "Network Change");
    });

    test("custom event renders its name", async () => {
      await expect(
        replay.selectEvent("custom", /custom_event_all_attrs/).first(),
      ).toBeVisible();
    });

    test("custom event expands to show its attributes", async () => {
      const custom = replay
        .selectEvent("custom", /custom_event_all_attrs/)
        .first();
      await custom.click();
      await expect(replay.eventDetails).toContainText("string_attr");
      await expect(replay.eventDetails).toContainText("hello");
    });

    test("lifecycle activity event expands to show its class name", async () => {
      const activity = replay.selectEvent("lifecycle_activity").first();
      await activity.click();
      await expect(replay.eventDetails).toContainText(
        "sh.frankenstein.android",
      );
    });

    test("native manual logs render at every severity", async () => {
      for (const severity of LOG_SEVERITIES) {
        await expect(
          selectLog(replay, "manual log from android native", severity),
        ).toBeVisible();
      }
    });

    test("native manual log expands to show its attributes", async () => {
      const log = selectLog(
        replay,
        "manual log from android native",
        "Warning",
      );
      await log.click();
      await expect(replay.eventDetails).toContainText("retry_count");
    });

    test("automatically collected logcat log renders with its tag", async () => {
      await expect(
        selectLog(
          replay,
          "NativeAndroid: logcat log from android native",
          "Info",
        ),
      ).toBeVisible();
    });
  });

  test.describe("ios", { tag: "@ios" }, () => {
    test("renders the ios-only events", async () => {
      await expectEvent(
        replay,
        "lifecycle_view_controller",
        "View Controller",
      );
    });

    test("custom event renders its name", async () => {
      await expect(
        replay.selectEvent("custom", /button_click/).first(),
      ).toBeVisible();
    });

    test("custom event expands to show its attributes", async () => {
      const custom = replay.selectEvent("custom", /button_click/).first();
      await custom.click();
      await expect(replay.eventDetails).toContainText("screen");
      await expect(replay.eventDetails).toContainText("NativeIOS");
    });

    test("lifecycle view controller event expands to show its class name", async () => {
      const vc = replay
        .selectEvent("lifecycle_view_controller", /NativeIOSViewController/)
        .first();
      await vc.click();
      await expect(replay.eventDetails).toContainText(
        "NativeIOSViewController",
      );
    });

    test("native manual logs render at every severity", async () => {
      for (const severity of LOG_SEVERITIES) {
        await expect(
          selectLog(replay, "manual log from ios native", severity),
        ).toBeVisible();
      }
    });

    test("native manual log expands to show its attributes", async () => {
      const log = selectLog(replay, "manual log from ios native", "Warning");
      await log.click();
      await expect(replay.eventDetails).toContainText("retry_count");
    });
  });
});
