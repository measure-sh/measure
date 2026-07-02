import { expect, test } from "../../fixtures.ts";
import { SessionTimelinesOverviewPage } from "../../pages/session_timelines_overview_page.ts";
import { SessionTimelinePage } from "../../pages/session_timeline_page.ts";

const USER_ID = "session_timeline_test_user";

async function expectEvent(
  timeline: SessionTimelinePage,
  type: string,
  pill: string,
) {
  const event = timeline.selectEvent(type).first();
  await expect(event).toBeVisible();
  await expect(timeline.selectEventPill(event, pill)).toBeVisible();
}

test.describe("session timeline", () => {
  let timeline: SessionTimelinePage;

  test.beforeEach(async ({ page, appId, teamId }) => {
    const overview = new SessionTimelinesOverviewPage(page, teamId);
    await overview.goto(appId);
    await overview.search(USER_ID);
    await expect(overview.sessionRow.first()).toBeVisible();
    await overview.openSession();
    timeline = new SessionTimelinePage(page, teamId);
    await expect(timeline.eventsList).toBeVisible();
  });

  test("header shows the tagged user id", async () => {
    await expect(timeline.userIdHeader(USER_ID)).toBeVisible();
  });

  test("renders the cross-platform events", async () => {
    await expectEvent(timeline, "gesture_click", "Click");
    await expectEvent(timeline, "http", "HTTP");
    await expectEvent(timeline, "custom", "Custom");
    await expectEvent(timeline, "trace", "Trace");
    await expectEvent(timeline, "lifecycle_app", "App");
  });

  test("http event shows the method and opens details", async () => {
    const http = timeline.selectEvent("http").first();
    await expect(http).toBeVisible();
    await expect(http).toContainText(/GET|POST|PUT|DELETE|PATCH|HEAD/);
    await http.click();
    await expect(timeline.eventDetails).toBeVisible();
  });

  test("handled error event links to error details", async () => {
    const error = timeline.selectError(/./).first();
    await expect(
      timeline.selectEventPill(error, "Handled Error"),
    ).toBeVisible();
    await error.click();
    await timeline.openErrorDetails();
  });

  test("trace event links to trace details", async () => {
    const trace = timeline.selectEvent("trace").first();
    await trace.click();
    await timeline.openTraceDetails();
  });

  test("trace event expands to show its trace fields", async () => {
    const trace = timeline.selectEvent("trace").first();
    await trace.click();
    await expect(timeline.eventDetails).toContainText("trace_id");
    await expect(timeline.eventDetails).toContainText("trace_name");
  });

  // The maestro flows reach buttons with scrollUntilVisible, so the SDK
  // captures scroll gestures naturally without an explicit flow step.
  test("gesture scroll event expands to show its target", async () => {
    const scroll = timeline.selectEvent("gesture_scroll").first();
    await expect(scroll).toBeVisible();
    await scroll.click();
    await expect(timeline.eventDetails).toContainText("target");
  });

  test("lifecycle app event expands to show its type", async () => {
    const lifecycle = timeline.selectEvent("lifecycle_app").first();
    await lifecycle.click();
    await expect(timeline.eventDetails).toContainText(/foreground|background/);
  });

  test("event type filter narrows the timeline to one type", async () => {
    await timeline.filterByEventType("http");
    await expect(timeline.selectEvent("http").first()).toBeVisible();
    await expect(
      timeline.selectEvent("gesture_click").first(),
    ).not.toBeVisible();
  });

  test.describe("android", { tag: "@android" }, () => {
    test("renders the android-only events", async () => {
      await expectEvent(timeline, "screen_view", "Screen View");
      await expectEvent(timeline, "lifecycle_activity", "Activity");
      await expectEvent(timeline, "network_change", "network_change");
    });

    test("custom event renders its name", async () => {
      await expect(
        timeline.selectEvent("custom", /custom_event_all_attrs/).first(),
      ).toBeVisible();
    });

    test("custom event expands to show its attributes", async () => {
      const custom = timeline
        .selectEvent("custom", /custom_event_all_attrs/)
        .first();
      await custom.click();
      await expect(timeline.eventDetails).toContainText("string_attr");
      await expect(timeline.eventDetails).toContainText("hello");
    });

    test("lifecycle activity event expands to show its class name", async () => {
      const activity = timeline.selectEvent("lifecycle_activity").first();
      await activity.click();
      await expect(timeline.eventDetails).toContainText(
        "sh.frankenstein.android",
      );
    });
  });

  test.describe("ios", { tag: "@ios" }, () => {
    test("renders the ios-only events", async () => {
      await expectEvent(
        timeline,
        "lifecycle_view_controller",
        "View Controller",
      );
    });

    test("custom event renders its name", async () => {
      await expect(
        timeline.selectEvent("custom", /button_click/).first(),
      ).toBeVisible();
    });

    test("custom event expands to show its attributes", async () => {
      const custom = timeline.selectEvent("custom", /button_click/).first();
      await custom.click();
      await expect(timeline.eventDetails).toContainText("screen");
      await expect(timeline.eventDetails).toContainText("NativeIOS");
    });

    test("lifecycle view controller event expands to show its class name", async () => {
      const vc = timeline
        .selectEvent("lifecycle_view_controller", /NativeIOSViewController/)
        .first();
      await vc.click();
      await expect(timeline.eventDetails).toContainText(
        "NativeIOSViewController",
      );
    });
  });
});
