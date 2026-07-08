import { expect, test } from "../../fixtures.ts";
import { BugReportsOverviewPage } from "../../pages/bug_reports_overview_page.ts";
import { BugReportDetailPage } from "../../pages/bug_report_detail_page.ts";
import { SessionTimelinePage } from "../../pages/session_timeline_page.ts";

const NATIVE_DESCRIPTION = "e2e-bug-report";
const FLUTTER_DESCRIPTION = "e2e-flutter-bug-report";
const RN_DESCRIPTION = "e2e-rn-bug-report";

test.describe("bug reports", () => {
  let overview: BugReportsOverviewPage;

  test.beforeEach(async ({ page, appId, teamId }) => {
    overview = new BugReportsOverviewPage(page, teamId);
    await overview.goto(appId);
    await expect(
      overview.selectBugReportRowByDescription(NATIVE_DESCRIPTION).first(),
    ).toBeVisible();
    await expect(
      overview.selectBugReportRowByDescription(FLUTTER_DESCRIPTION).first(),
    ).toBeVisible();
    await expect(
      overview.selectBugReportRowByDescription(RN_DESCRIPTION).first(),
    ).toBeVisible();
  });

  test("overview lists the bug reports", async () => {
    await expect(overview.bugReportsPlot).toBeVisible();
  });

  test.describe("native", () => {
    const description = NATIVE_DESCRIPTION;

    test("clicking the row opens the bug report detail page", async ({
      page,
      teamId,
    }) => {
      await overview.openBugReport(description);
      const detail = new BugReportDetailPage(page, teamId);

      await expect(detail.description).toHaveText(description);

      await expect(detail.status).toHaveText("Open");
      await expect(detail.userIdPill).toHaveText(/User ID:\s+\S/);
      await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
      await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
      await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
      await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);

      await expect.poll(() => detail.renderedScreenshotCount()).toBe(2);

      await expect
        .soft(detail.sessionTimelineLink)
        .toHaveAttribute("href", /\/session_timelines\//);
    });

    test("status toggle changes the badge and reverts cleanly", async ({
      page,
      teamId,
    }) => {
      await overview.openBugReport(description);
      const detail = new BugReportDetailPage(page, teamId);

      await expect(detail.status).toHaveText("Open");

      await detail.statusToggleButton.click();
      await expect(detail.status).toHaveText("Closed");

      await detail.statusToggleButton.click();
      await expect(detail.status).toHaveText("Open");
    });

    test("session timeline renders the bug report event", async ({
      page,
      teamId,
    }) => {
      await overview.openBugReport(description);
      const detail = new BugReportDetailPage(page, teamId);
      await detail.openSessionTimeline();
      const timeline = new SessionTimelinePage(page, teamId);

      await expect(timeline.eventsList).toBeVisible();
      const event = timeline.selectBugReport(/e2e-bug-report/);
      await expect(event).toBeVisible();
      await expect(timeline.selectEventPill(event, "Bug Report")).toBeVisible();

      await event.click();
      await timeline.openBugReportDetails();
      await expect(detail.description).toHaveText(description);
    });
  });

  test.describe("flutter", () => {
    const description = FLUTTER_DESCRIPTION;

    test("clicking the row opens the bug report detail page", async ({
      page,
      teamId,
    }) => {
      await overview.openBugReport(description);
      const detail = new BugReportDetailPage(page, teamId);

      await expect(detail.description).toHaveText(description);

      await expect(detail.status).toHaveText("Open");
      await expect(detail.userIdPill).toHaveText(/User ID:\s+\S/);
      await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
      await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
      await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
      await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);

      await expect.poll(() => detail.renderedScreenshotCount()).toBe(2);

      await expect
        .soft(detail.sessionTimelineLink)
        .toHaveAttribute("href", /\/session_timelines\//);
    });

    test("session timeline renders the bug report event", async ({
      page,
      teamId,
    }) => {
      await overview.openBugReport(description);
      const detail = new BugReportDetailPage(page, teamId);
      await detail.openSessionTimeline();
      const timeline = new SessionTimelinePage(page, teamId);

      await expect(timeline.eventsList).toBeVisible();
      const event = timeline.selectBugReport(/e2e-flutter-bug-report/);
      await expect(event).toBeVisible();
      await expect(timeline.selectEventPill(event, "Bug Report")).toBeVisible();

      await event.click();
      await timeline.openBugReportDetails();
      await expect(detail.description).toHaveText(description);
    });
  });

  test.describe("react native", () => {
    const description = RN_DESCRIPTION;

    test("clicking the row opens the bug report detail page", async ({
      page,
      teamId,
    }) => {
      await overview.openBugReport(description);
      const detail = new BugReportDetailPage(page, teamId);

      await expect(detail.description).toHaveText(description);

      await expect(detail.status).toHaveText("Open");
      await expect(detail.userIdPill).toHaveText(/User ID:\s+\S/);
      await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
      await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
      await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
      await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);

      // launchBugReport attaches the auto-captured screenshot plus the
      // gallery image.
      await expect.poll(() => detail.renderedScreenshotCount()).toBe(2);

      await expect
        .soft(detail.sessionTimelineLink)
        .toHaveAttribute("href", /\/session_timelines\//);
    });

    test("session timeline renders the bug report event", async ({
      page,
      teamId,
    }) => {
      await overview.openBugReport(description);
      const detail = new BugReportDetailPage(page, teamId);
      await detail.openSessionTimeline();
      const timeline = new SessionTimelinePage(page, teamId);

      await expect(timeline.eventsList).toBeVisible();
      const event = timeline.selectBugReport(/e2e-rn-bug-report/);
      await expect(event).toBeVisible();
      await expect(timeline.selectEventPill(event, "Bug Report")).toBeVisible();

      await event.click();
      await timeline.openBugReportDetails();
      await expect(detail.description).toHaveText(description);
    });
  });
});
