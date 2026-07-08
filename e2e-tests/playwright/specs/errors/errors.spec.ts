import { expect, test } from "../../fixtures.ts";
import { ErrorsOverviewPage } from "../../pages/errors_overview_page.ts";
import { ErrorDetailPage } from "../../pages/error_detail_page.ts";
import { SessionTimelinePage } from "../../pages/session_timeline_page.ts";

test.describe("errors", () => {
  test.describe("fatal error", () => {
    let overview: ErrorsOverviewPage;

    test.beforeEach(async ({ page, appId, teamId }) => {
      overview = new ErrorsOverviewPage(page, teamId);
      await overview.gotoFatalErrors(appId);
    });

    test.describe("android", { tag: "@android" }, () => {
      const subtitle = /^java\.lang\.IllegalAccessException/;
      const errorPill = "Error";
      const fatalPill = "Fatal";

      test.beforeEach(() =>
        expect(overview.selectErrorGroupRowByType(subtitle)).toBeVisible(),
      );

      test("error group row renders the fatal error", async () => {
        const row = overview.selectErrorGroupRowByType(subtitle);
        await expect(row).toBeVisible();
        await expect(overview.selectGroupRowPill(row, errorPill)).toBeVisible();
        await expect(overview.selectGroupRowPill(row, fatalPill)).toBeVisible();
        await expect(
          overview.selectGroupRowPercentageContribution(row),
        ).toBeVisible();
      });

      test("error details renders the fatal error", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);

        await expect(detail.errorInstancesPlot).toBeVisible();
        await expect(detail.attributeDistributionPlot).toBeVisible();
        await expect(detail.commonPathSection).toBeVisible();
        await expect(detail.commonPathSection).toContainText("Common Path");
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
        await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
        await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
        await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
        await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);
        await expect(detail.copyAiContextButton).toBeVisible();

        await expect(detail.selectErrorPill(errorPill)).toBeVisible();
        await expect(detail.selectErrorPill(fatalPill)).toBeVisible();

        await expect(detail.screenshot).toBeVisible();

        await expect(detail.errorThreadStacktrace).toContainText(
          "java.lang.IllegalAccessException",
        );
        await expect(detail.errorThreadStacktrace).toContainText(
          "sh.frankenstein.android.NativeAndroidScreenKt",
        );
      });

      test("session timeline renders the fatal error event", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);
        await detail.openSessionTimeline();
        const timeline = new SessionTimelinePage(page, teamId);

        await expect(timeline.eventsList).toBeVisible();
        const event = timeline.selectError(
          /java\.lang\.IllegalAccessException/,
        );
        await expect(event).toBeVisible();
        await expect(
          timeline.selectEventPill(event, "Fatal Error"),
        ).toBeVisible();

        await event.click();
        await expect(timeline.eventDetails).toContainText(
          "java.lang.IllegalAccessException",
        );
        await expect(timeline.eventDetails).toContainText(
          "sh.frankenstein.android.NativeAndroidScreenKt",
        );

        await timeline.openErrorDetails();
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
      });
    });

    test.describe("ios", { tag: "@ios" }, () => {
      const errorPill = "Error";
      const fatalPill = "Fatal";

      const selectRow = () =>
        overview.selectErrorGroupRowByTitle(/NativeIOSViewController\.swift/);

      test.beforeEach(() => expect(selectRow()).toBeVisible());

      test("error group row renders the fatal error", async () => {
        const row = selectRow();
        await expect(row).toBeVisible();
        await expect(overview.selectGroupRowPill(row, errorPill)).toBeVisible();
        await expect(overview.selectGroupRowPill(row, fatalPill)).toBeVisible();
        await expect(
          overview.selectGroupRowPercentageContribution(row),
        ).toBeVisible();
      });

      test("error details renders the fatal error", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroup(selectRow());
        const detail = new ErrorDetailPage(page, teamId);

        await expect(detail.errorInstancesPlot).toBeVisible();
        await expect(detail.attributeDistributionPlot).toBeVisible();
        await expect(detail.commonPathSection).toBeVisible();
        await expect(detail.commonPathSection).toContainText("Common Path");
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
        await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
        await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
        await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
        await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);
        await expect(detail.copyAiContextButton).toBeVisible();

        await expect(detail.selectErrorPill(errorPill)).toBeVisible();
        await expect(detail.selectErrorPill(fatalPill)).toBeVisible();

        await expect(detail.errorThreadStacktrace).toContainText(
          "FrankensteinApp",
        );
        await expect(detail.errorThreadStacktrace).toContainText(
          "triggerCrash(DemoAction)",
        );
        await expect(detail.errorThreadStacktrace).toContainText(
          "NativeIOSViewController.swift",
        );
      });

      test("session timeline renders the fatal error event", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroup(selectRow());
        const detail = new ErrorDetailPage(page, teamId);
        await detail.openSessionTimeline();
        const timeline = new SessionTimelinePage(page, teamId);

        await expect(timeline.eventsList).toBeVisible();
        const event = timeline.selectError(/SIGABRT/);
        await expect(event).toBeVisible();
        await expect(
          timeline.selectEventPill(event, "Fatal Error"),
        ).toBeVisible();

        await event.click();
        await expect(timeline.eventDetails).toContainText("FrankensteinApp");
        await expect(timeline.eventDetails).toContainText(
          "triggerCrash(DemoAction)",
        );
        await expect(timeline.eventDetails).toContainText(
          "NativeIOSViewController.swift",
        );

        await timeline.openErrorDetails();
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
      });
    });

    test.describe("kmp android", { tag: "@android" }, () => {
      const subtitle =
        /^java\.lang\.IllegalStateException:Crash from shared Kotlin code/;
      const errorPill = "Error";
      const fatalPill = "Fatal";

      test.beforeEach(() =>
        expect(overview.selectErrorGroupRowByType(subtitle)).toBeVisible(),
      );

      test("error group row renders the fatal error", async () => {
        const row = overview.selectErrorGroupRowByType(subtitle);
        await expect(row).toBeVisible();
        await expect(overview.selectGroupRowPill(row, errorPill)).toBeVisible();
        await expect(overview.selectGroupRowPill(row, fatalPill)).toBeVisible();
        await expect(
          overview.selectGroupRowPercentageContribution(row),
        ).toBeVisible();
      });

      test("error details renders the fatal error", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);

        await expect(detail.errorInstancesPlot).toBeVisible();
        await expect(detail.attributeDistributionPlot).toBeVisible();
        await expect(detail.commonPathSection).toBeVisible();
        await expect(detail.commonPathSection).toContainText("Common Path");
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
        await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
        await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
        await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
        await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);
        await expect(detail.copyAiContextButton).toBeVisible();

        await expect(detail.selectErrorPill(errorPill)).toBeVisible();
        await expect(detail.selectErrorPill(fatalPill)).toBeVisible();

        await expect(detail.errorThreadStacktrace).toContainText(
          "java.lang.IllegalStateException",
        );
        await expect(detail.errorThreadStacktrace).toContainText(
          "com.frankenstein.shared.CmpScreenKt",
        );
      });

      test("session timeline renders the fatal error event", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);
        await detail.openSessionTimeline();
        const timeline = new SessionTimelinePage(page, teamId);

        await expect(timeline.eventsList).toBeVisible();
        const event = timeline.selectError(/java\.lang\.IllegalStateException/);
        await expect(event).toBeVisible();
        await expect(
          timeline.selectEventPill(event, "Fatal Error"),
        ).toBeVisible();

        await event.click();
        await expect(timeline.eventDetails).toContainText(
          "java.lang.IllegalStateException",
        );
        await expect(timeline.eventDetails).toContainText(
          "com.frankenstein.shared.CmpScreenKt",
        );

        await timeline.openErrorDetails();
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
      });
    });

    test.describe("kmp ios", { tag: "@ios" }, () => {
      const errorPill = "Error";
      const fatalPill = "Fatal";

      const title = /CmpScreen\.kt/;
      const selectRow = () => overview.selectErrorGroupRowByTitle(title);

      test.beforeEach(() => expect(selectRow()).toBeVisible());

      test("error group row renders the fatal error", async () => {
        const row = selectRow();
        await expect(row).toBeVisible();
        await expect(overview.selectGroupRowPill(row, errorPill)).toBeVisible();
        await expect(overview.selectGroupRowPill(row, fatalPill)).toBeVisible();
        await expect(
          overview.selectGroupRowPercentageContribution(row),
        ).toBeVisible();
      });

      test("error details renders the fatal error", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroup(selectRow());
        const detail = new ErrorDetailPage(page, teamId);

        await expect(detail.errorInstancesPlot).toBeVisible();
        await expect(detail.attributeDistributionPlot).toBeVisible();
        await expect(detail.commonPathSection).toBeVisible();
        await expect(detail.commonPathSection).toContainText("Common Path");
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
        await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
        await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
        await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
        await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);
        await expect(detail.copyAiContextButton).toBeVisible();

        await expect(detail.selectErrorPill(errorPill)).toBeVisible();
        await expect(detail.selectErrorPill(fatalPill)).toBeVisible();

        await expect(detail.errorThreadStacktrace).toContainText(
          "FrankensteinApp",
        );
        await expect(detail.errorThreadStacktrace).toContainText(
          "com.frankenstein.shared.demos",
        );
        await expect(detail.errorThreadStacktrace).toContainText(
          "CmpScreen.kt",
        );
      });

      test("session timeline renders the fatal error event", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroup(selectRow());
        const detail = new ErrorDetailPage(page, teamId);
        await detail.openSessionTimeline();
        const timeline = new SessionTimelinePage(page, teamId);

        await expect(timeline.eventsList).toBeVisible();
        const event = timeline.selectError(/SIGABRT/);
        await expect(event).toBeVisible();
        await expect(
          timeline.selectEventPill(event, "Fatal Error"),
        ).toBeVisible();

        await event.click();
        await expect(timeline.eventDetails).toContainText("FrankensteinApp");
        await expect(timeline.eventDetails).toContainText(
          "com.frankenstein.shared.demos",
        );
        await expect(timeline.eventDetails).toContainText("CmpScreen.kt");

        await timeline.openErrorDetails();
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
      });
    });

    test.describe("react native", () => {
      const subtitle = /^Error:Simulated JavaScript exception/;
      const errorPill = "Error";
      const fatalPill = "Fatal";

      test.beforeEach(() =>
        expect(overview.selectErrorGroupRowByType(subtitle)).toBeVisible(),
      );

      test("error group row renders the fatal error", async () => {
        const row = overview.selectErrorGroupRowByType(subtitle);
        await expect(row).toBeVisible();
        await expect(overview.selectGroupRowPill(row, errorPill)).toBeVisible();
        await expect(overview.selectGroupRowPill(row, fatalPill)).toBeVisible();
        await expect(
          overview.selectGroupRowPercentageContribution(row),
        ).toBeVisible();
      });

      test("error details renders the fatal error", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);

        await expect(detail.errorInstancesPlot).toBeVisible();
        await expect(detail.attributeDistributionPlot).toBeVisible();
        await expect(detail.commonPathSection).toBeVisible();
        await expect(detail.commonPathSection).toContainText("Common Path");
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
        await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
        await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
        await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
        await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);
        await expect(detail.copyAiContextButton).toBeVisible();

        await expect(detail.selectErrorPill(errorPill)).toBeVisible();
        await expect(detail.selectErrorPill(fatalPill)).toBeVisible();

        await expect(detail.errorThreadStacktrace).toContainText(
          "throwJSException",
        );
        await expect(detail.errorThreadStacktrace).toContainText("index.js");
      });

      test("session timeline renders the fatal error event", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);
        await detail.openSessionTimeline();
        const timeline = new SessionTimelinePage(page, teamId);

        await expect(timeline.eventsList).toBeVisible();
        const event = timeline.selectError(
          /Error: Simulated JavaScript exception/,
        );
        await expect(event).toBeVisible();
        await expect(
          timeline.selectEventPill(event, "Fatal Error"),
        ).toBeVisible();

        await event.click();
        await expect(timeline.eventDetails).toContainText(
          "Simulated JavaScript exception",
        );
        await expect(timeline.eventDetails).toContainText("throwJSException");
        await expect(timeline.eventDetails).toContainText("index.js");

        await timeline.openErrorDetails();
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
      });
    });

    test.describe("anr", { tag: "@android" }, () => {
      const anrPill = "ANR";
      const fatalPill = "Fatal";

      const selectRow = () =>
        overview.selectErrorGroupRowByTitle(/NativeAndroidScreen\.kt/);

      test.beforeEach(async ({ appId }) => {
        await overview.gotoAnrs(appId);
        await expect(selectRow()).toBeVisible();
      });

      test("error group row renders the anr", async () => {
        const row = selectRow();
        await expect(row).toBeVisible();
        await expect(overview.selectGroupRowPill(row, anrPill)).toBeVisible();
        await expect(overview.selectGroupRowPill(row, fatalPill)).toBeVisible();
        await expect(
          overview.selectGroupRowPercentageContribution(row),
        ).toBeVisible();
      });

      test("error details renders the anr", async ({ page, teamId }) => {
        await overview.openErrorGroup(selectRow());
        const detail = new ErrorDetailPage(page, teamId);

        await expect(detail.errorInstancesPlot).toBeVisible();
        await expect(detail.attributeDistributionPlot).toBeVisible();
        await expect(detail.commonPathSection).toBeVisible();
        await expect(detail.commonPathSection).toContainText("Common Path");
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
        await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
        await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
        await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
        await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);
        await expect(detail.copyAiContextButton).toBeVisible();

        await expect(detail.selectErrorPill(anrPill)).toBeVisible();
        await expect(detail.selectErrorPill(fatalPill)).toBeVisible();

        await expect(detail.errorThreadStacktrace).toContainText(
          "sh.measure.android.anr.AnrError",
        );
        await expect(detail.errorThreadStacktrace).toContainText(
          "sh.frankenstein.android.NativeAndroidScreenKt",
        );
      });

      test("session timeline renders the anr event", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroup(selectRow());
        const detail = new ErrorDetailPage(page, teamId);
        await detail.openSessionTimeline();
        const timeline = new SessionTimelinePage(page, teamId);

        await expect(timeline.eventsList).toBeVisible();
        const event = timeline.selectAnr(/sh\.measure\.android\.anr\.AnrError/);
        await expect(event).toBeVisible();
        await expect(timeline.selectEventPill(event, anrPill)).toBeVisible();

        await event.click();
        await expect(timeline.eventDetails).toContainText(
          "sh.measure.android.anr.AnrError",
        );
        await expect(timeline.eventDetails).toContainText(
          "sh.frankenstein.android.NativeAndroidScreenKt",
        );

        await timeline.openAnrDetails();
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
      });
    });
  });

  test.describe("unhandled error", () => {
    let overview: ErrorsOverviewPage;

    test.beforeEach(async ({ page, appId, teamId }) => {
      overview = new ErrorsOverviewPage(page, teamId);
      await overview.gotoUnhandledErrors(appId);
    });

    test.describe("flutter", () => {
      const title =
        "flutter_demo_screen.dart: _FlutterDemoScreenState._throwException()";
      const subtitle = /^FormatException:This is an exception/;
      const errorPill = "Error";
      const unhandledPill = "Unhandled";

      test.beforeEach(() =>
        expect(overview.selectErrorGroupRowByType(subtitle)).toBeVisible(),
      );

      test("error group row renders the unhandled error", async () => {
        const row = overview.selectErrorGroupRowByType(subtitle);
        await expect(row).toBeVisible();
        await expect(overview.selectGroupRowTitle(row, title)).toBeVisible();
        await expect(overview.selectGroupRowPill(row, errorPill)).toBeVisible();
        await expect(
          overview.selectGroupRowPill(row, unhandledPill),
        ).toBeVisible();
        await expect(
          overview.selectGroupRowPercentageContribution(row),
        ).toBeVisible();
      });

      test("error details renders the unhandled error", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);

        await expect(detail.errorInstancesPlot).toBeVisible();
        await expect(detail.attributeDistributionPlot).toBeVisible();
        await expect(detail.commonPathSection).toBeVisible();
        await expect(detail.commonPathSection).toContainText("Common Path");
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
        await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
        await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
        await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
        await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);
        await expect(detail.copyAiContextButton).toBeVisible();

        await expect(detail.selectErrorPill(errorPill)).toBeVisible();
        await expect(detail.selectErrorPill(unhandledPill)).toBeVisible();

        await expect(detail.errorThreadStacktrace).toContainText(
          /#00\s+_FlutterDemoScreenState\._throwException/,
        );
        await expect(detail.errorThreadStacktrace).toContainText(
          /#00\s.*flutter_demo_screen\.dart/,
        );
      });

      test("session timeline renders the unhandled error event", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);
        await detail.openSessionTimeline();
        const timeline = new SessionTimelinePage(page, teamId);

        await expect(timeline.eventsList).toBeVisible();
        const event = timeline.selectError(
          /FormatException: This is an exception/,
        );
        await expect(event).toBeVisible();
        await expect(
          timeline.selectEventPill(event, "Unhandled Error"),
        ).toBeVisible();

        await event.click();
        await expect(timeline.eventDetails).toContainText(
          /#00\s+_FlutterDemoScreenState\._throwException/,
        );
        await expect(timeline.eventDetails).toContainText(
          /#00\s.*flutter_demo_screen\.dart/,
        );

        await timeline.openErrorDetails();
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
      });
    });

    test.describe("react native", () => {
      const subtitle = /^Error:Simulated unhandled promise rejection/;
      const errorPill = "Error";
      const unhandledPill = "Unhandled";

      test.beforeEach(() =>
        expect(overview.selectErrorGroupRowByType(subtitle)).toBeVisible(),
      );

      test("error group row renders the unhandled error", async () => {
        const row = overview.selectErrorGroupRowByType(subtitle);
        await expect(row).toBeVisible();
        await expect(overview.selectGroupRowPill(row, errorPill)).toBeVisible();
        await expect(
          overview.selectGroupRowPill(row, unhandledPill),
        ).toBeVisible();
        await expect(
          overview.selectGroupRowPercentageContribution(row),
        ).toBeVisible();
      });

      test("error details renders the unhandled error", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);

        await expect(detail.errorInstancesPlot).toBeVisible();
        await expect(detail.attributeDistributionPlot).toBeVisible();
        await expect(detail.commonPathSection).toBeVisible();
        await expect(detail.commonPathSection).toContainText("Common Path");
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
        await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
        await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
        await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
        await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);
        await expect(detail.copyAiContextButton).toBeVisible();

        await expect(detail.selectErrorPill(errorPill)).toBeVisible();
        await expect(detail.selectErrorPill(unhandledPill)).toBeVisible();

        await expect(detail.errorThreadStacktrace).toContainText(
          "throwUnhandledRejection",
        );
        await expect(detail.errorThreadStacktrace).toContainText("index.js");
      });

      test("session timeline renders the unhandled error event", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);
        await detail.openSessionTimeline();
        const timeline = new SessionTimelinePage(page, teamId);

        await expect(timeline.eventsList).toBeVisible();
        const event = timeline.selectError(
          /Error: Simulated unhandled promise rejection/,
        );
        await expect(event).toBeVisible();
        await expect(
          timeline.selectEventPill(event, "Unhandled Error"),
        ).toBeVisible();

        await event.click();
        await expect(timeline.eventDetails).toContainText(
          "Simulated unhandled promise rejection",
        );
        await expect(timeline.eventDetails).toContainText(
          "throwUnhandledRejection",
        );
        await expect(timeline.eventDetails).toContainText("index.js");

        await timeline.openErrorDetails();
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
      });
    });
  });

  test.describe("handled error", () => {
    let overview: ErrorsOverviewPage;

    test.beforeEach(async ({ page, appId, teamId }) => {
      overview = new ErrorsOverviewPage(page, teamId);
      await overview.gotoHandledErrors(appId);
    });

    test.describe("flutter", () => {
      const title =
        "flutter_demo_screen.dart: _FlutterDemoScreenState._trackHandledError()";
      const subtitle = /^_CustomException:Handled error caught by the app/;
      const errorPill = "Error";
      const handledPill = "Handled";

      test.beforeEach(() =>
        expect(overview.selectErrorGroupRowByType(subtitle)).toBeVisible(),
      );

      test("error group row renders the handled error", async () => {
        const row = overview.selectErrorGroupRowByType(subtitle);
        await expect(row).toBeVisible();
        await expect(overview.selectGroupRowTitle(row, title)).toBeVisible();
        await expect(overview.selectGroupRowPill(row, errorPill)).toBeVisible();
        await expect(
          overview.selectGroupRowPill(row, handledPill),
        ).toBeVisible();
        await expect(
          overview.selectGroupRowPercentageContribution(row),
        ).toBeVisible();
      });

      test("error details renders the handled error", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);

        await expect(detail.errorInstancesPlot).toBeVisible();
        await expect(detail.attributeDistributionPlot).toBeVisible();
        await expect(detail.commonPathSection).toBeVisible();
        await expect(detail.commonPathSection).toContainText("Common Path");
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
        await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
        await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
        await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
        await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);
        await expect(detail.copyAiContextButton).toBeVisible();

        await expect(detail.selectErrorPill(errorPill)).toBeVisible();
        await expect(detail.selectErrorPill(handledPill)).toBeVisible();

        await expect(detail.userDefinedAttribute).toBeVisible();
        await expect(detail.userDefinedAttribute).toContainText(
          '"order_id": "order-12345"',
        );

        await expect(detail.errorThreadStacktrace).toContainText(
          /#00\s+_FlutterDemoScreenState\._trackHandledError/,
        );
        await expect(detail.errorThreadStacktrace).toContainText(
          /#00\s.*flutter_demo_screen\.dart/,
        );
      });

      test("session timeline renders the handled error event", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);
        await detail.openSessionTimeline();
        const timeline = new SessionTimelinePage(page, teamId);

        await expect(timeline.eventsList).toBeVisible();
        const event = timeline.selectError(
          /_CustomException: Handled error caught by the app/,
        );
        await expect(event).toBeVisible();
        await expect(
          timeline.selectEventPill(event, "Handled Error"),
        ).toBeVisible();

        await event.click();
        await expect(timeline.eventDetails).toContainText(
          /#00\s+_FlutterDemoScreenState\._trackHandledError/,
        );
        await expect(timeline.eventDetails).toContainText(
          /#00\s.*flutter_demo_screen\.dart/,
        );

        await timeline.openErrorDetails();
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
      });
    });

    test.describe("android", { tag: "@android" }, () => {
      const subtitle = /^sh\.frankenstein\.android\.CustomException/;
      const errorPill = "Error";
      const handledPill = "Handled";

      test.beforeEach(() =>
        expect(overview.selectErrorGroupRowByType(subtitle)).toBeVisible(),
      );

      test("error group row renders the handled error", async () => {
        const row = overview.selectErrorGroupRowByType(subtitle);
        await expect(row).toBeVisible();
        await expect(overview.selectGroupRowPill(row, errorPill)).toBeVisible();
        await expect(
          overview.selectGroupRowPill(row, handledPill),
        ).toBeVisible();
        await expect(
          overview.selectGroupRowPercentageContribution(row),
        ).toBeVisible();
      });

      test("error details renders the handled error", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);

        await expect(detail.errorInstancesPlot).toBeVisible();
        await expect(detail.attributeDistributionPlot).toBeVisible();
        await expect(detail.commonPathSection).toBeVisible();
        await expect(detail.commonPathSection).toContainText("Common Path");
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
        await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
        await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
        await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
        await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);
        await expect(detail.copyAiContextButton).toBeVisible();

        await expect(detail.selectErrorPill(errorPill)).toBeVisible();
        await expect(detail.selectErrorPill(handledPill)).toBeVisible();

        await expect(detail.userDefinedAttribute).toBeVisible();
        await expect(detail.userDefinedAttribute).toContainText(
          '"string_attr": "hello"',
        );

        await expect(detail.errorThreadStacktrace).toContainText(
          "sh.frankenstein.android.CustomException",
        );
        await expect(detail.errorThreadStacktrace).toContainText(
          "sh.frankenstein.android.NativeAndroidScreenKt",
        );
      });

      test("session timeline renders the handled error event", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);
        await detail.openSessionTimeline();
        const timeline = new SessionTimelinePage(page, teamId);

        await expect(timeline.eventsList).toBeVisible();
        const event = timeline.selectError(
          /sh\.frankenstein\.android\.CustomException/,
        );
        await expect(event).toBeVisible();
        await expect(
          timeline.selectEventPill(event, "Handled Error"),
        ).toBeVisible();

        await event.click();
        await expect(timeline.eventDetails).toContainText(
          "sh.frankenstein.android.CustomException",
        );
        await expect(timeline.eventDetails).toContainText(
          "sh.frankenstein.android.NativeAndroidScreenKt",
        );

        await timeline.openErrorDetails();
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
      });
    });

    test.describe("ios", { tag: "@ios" }, () => {
      const errorPill = "Error";
      const handledPill = "Handled";

      const selectRow = () =>
        overview.selectErrorGroupRowByTitle(
          /UserTriggeredEventCollector\.swift/,
        );

      test.beforeEach(() => expect(selectRow()).toBeVisible());

      test("error group row renders the handled error", async () => {
        const row = selectRow();
        await expect(row).toBeVisible();
        await expect(overview.selectGroupRowPill(row, errorPill)).toBeVisible();
        await expect(
          overview.selectGroupRowPill(row, handledPill),
        ).toBeVisible();
        await expect(
          overview.selectGroupRowPercentageContribution(row),
        ).toBeVisible();
      });

      test("error details renders the handled error", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroup(selectRow());
        const detail = new ErrorDetailPage(page, teamId);

        await expect(detail.errorInstancesPlot).toBeVisible();
        await expect(detail.attributeDistributionPlot).toBeVisible();
        await expect(detail.commonPathSection).toBeVisible();
        await expect(detail.commonPathSection).toContainText("Common Path");
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
        await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
        await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
        await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
        await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);
        await expect(detail.copyAiContextButton).toBeVisible();

        await expect(detail.selectErrorPill(errorPill)).toBeVisible();
        await expect(detail.selectErrorPill(handledPill)).toBeVisible();

        await expect(detail.errorThreadStacktrace).toContainText(
          "FrankensteinApp",
        );
        await expect(detail.errorThreadStacktrace).toContainText(
          "NativeIOSScreen.demoCard",
        );
        await expect(detail.errorThreadStacktrace).toContainText(
          "NativeIOSViewController.swift",
        );
      });

      test("session timeline renders the handled error event", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroup(selectRow());
        const detail = new ErrorDetailPage(page, teamId);
        await detail.openSessionTimeline();
        const timeline = new SessionTimelinePage(page, teamId);

        await expect(timeline.eventsList).toBeVisible();
        const event = timeline.selectError(/SIGABRT/);
        await expect(event).toBeVisible();
        await expect(
          timeline.selectEventPill(event, "Handled Error"),
        ).toBeVisible();

        await event.click();
        await expect(timeline.eventDetails).toContainText("FrankensteinApp");
        await expect(timeline.eventDetails).toContainText(
          "NativeIOSScreen.demoCard",
        );
        await expect(timeline.eventDetails).toContainText(
          "NativeIOSViewController.swift",
        );

        await timeline.openErrorDetails();
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
      });
    });

    test.describe("kmp android", { tag: "@android" }, () => {
      const subtitle = /^java\.lang\.RuntimeException:handled-from-kmp/;
      const errorPill = "Error";
      const handledPill = "Handled";

      test.beforeEach(() =>
        expect(overview.selectErrorGroupRowByType(subtitle)).toBeVisible(),
      );

      test("error group row renders the handled error", async () => {
        const row = overview.selectErrorGroupRowByType(subtitle);
        await expect(row).toBeVisible();
        await expect(overview.selectGroupRowPill(row, errorPill)).toBeVisible();
        await expect(
          overview.selectGroupRowPill(row, handledPill),
        ).toBeVisible();
        await expect(
          overview.selectGroupRowPercentageContribution(row),
        ).toBeVisible();
      });

      test("error details renders the handled error", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);

        await expect(detail.errorInstancesPlot).toBeVisible();
        await expect(detail.attributeDistributionPlot).toBeVisible();
        await expect(detail.commonPathSection).toBeVisible();
        await expect(detail.commonPathSection).toContainText("Common Path");
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
        await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
        await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
        await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
        await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);
        await expect(detail.copyAiContextButton).toBeVisible();

        await expect(detail.selectErrorPill(errorPill)).toBeVisible();
        await expect(detail.selectErrorPill(handledPill)).toBeVisible();

        await expect(detail.errorThreadStacktrace).toContainText(
          "java.lang.RuntimeException",
        );
        await expect(detail.errorThreadStacktrace).toContainText(
          "com.frankenstein.shared.CmpScreenKt",
        );
      });

      test("session timeline renders the handled error event", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);
        await detail.openSessionTimeline();
        const timeline = new SessionTimelinePage(page, teamId);

        await expect(timeline.eventsList).toBeVisible();
        const event = timeline.selectError(/java\.lang\.RuntimeException/);
        await expect(event).toBeVisible();
        await expect(
          timeline.selectEventPill(event, "Handled Error"),
        ).toBeVisible();

        await event.click();
        await expect(timeline.eventDetails).toContainText(
          "java.lang.RuntimeException",
        );
        await expect(timeline.eventDetails).toContainText(
          "com.frankenstein.shared.CmpScreenKt",
        );

        await timeline.openErrorDetails();
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
      });
    });

    test.describe("kmp ios", { tag: "@ios" }, () => {
      const errorPill = "Error";
      const handledPill = "Handled";

      const title = /CmpScreen\.kt/;
      const selectRow = () => overview.selectErrorGroupRowByTitle(title);

      test.beforeEach(() => expect(selectRow()).toBeVisible());

      test("error group row renders the handled error", async () => {
        const row = selectRow();
        await expect(row).toBeVisible();
        await expect(overview.selectGroupRowPill(row, errorPill)).toBeVisible();
        await expect(
          overview.selectGroupRowPill(row, handledPill),
        ).toBeVisible();
        await expect(
          overview.selectGroupRowPercentageContribution(row),
        ).toBeVisible();
      });

      test("error details renders the handled error", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroup(selectRow());
        const detail = new ErrorDetailPage(page, teamId);

        await expect(detail.errorInstancesPlot).toBeVisible();
        await expect(detail.attributeDistributionPlot).toBeVisible();
        await expect(detail.commonPathSection).toBeVisible();
        await expect(detail.commonPathSection).toContainText("Common Path");
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
        await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
        await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
        await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
        await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);
        await expect(detail.copyAiContextButton).toBeVisible();

        await expect(detail.selectErrorPill(errorPill)).toBeVisible();
        await expect(detail.selectErrorPill(handledPill)).toBeVisible();

        await expect(detail.errorThreadStacktrace).toContainText(
          "FrankensteinApp",
        );
        await expect(detail.errorThreadStacktrace).toContainText(
          "com.frankenstein.shared",
        );
        await expect(detail.errorThreadStacktrace).toContainText(
          "CmpScreen.kt",
        );
      });

      test("session timeline renders the handled error event", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroup(selectRow());
        const detail = new ErrorDetailPage(page, teamId);
        await detail.openSessionTimeline();
        const timeline = new SessionTimelinePage(page, teamId);

        await expect(timeline.eventsList).toBeVisible();
        const event = timeline.selectError(/SIGABRT/);
        await expect(event).toBeVisible();
        await expect(
          timeline.selectEventPill(event, "Handled Error"),
        ).toBeVisible();

        await event.click();
        await expect(timeline.eventDetails).toContainText("FrankensteinApp");
        await expect(timeline.eventDetails).toContainText(
          "com.frankenstein.shared",
        );
        await expect(timeline.eventDetails).toContainText("CmpScreen.kt");

        await timeline.openErrorDetails();
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
      });
    });

    test.describe("react native", () => {
      const subtitle = /^Error:Simulated handled exception/;
      const errorPill = "Error";
      const handledPill = "Handled";

      test.beforeEach(() =>
        expect(overview.selectErrorGroupRowByType(subtitle)).toBeVisible(),
      );

      test("error group row renders the handled error", async () => {
        const row = overview.selectErrorGroupRowByType(subtitle);
        await expect(row).toBeVisible();
        await expect(overview.selectGroupRowPill(row, errorPill)).toBeVisible();
        await expect(
          overview.selectGroupRowPill(row, handledPill),
        ).toBeVisible();
        await expect(
          overview.selectGroupRowPercentageContribution(row),
        ).toBeVisible();
      });

      test("error details renders the handled error", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);

        await expect(detail.errorInstancesPlot).toBeVisible();
        await expect(detail.attributeDistributionPlot).toBeVisible();
        await expect(detail.commonPathSection).toBeVisible();
        await expect(detail.commonPathSection).toContainText("Common Path");
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
        await expect(detail.timestampPill).toHaveText(/Time:\s+\S/);
        await expect(detail.devicePill).toHaveText(/Device:\s+\S/);
        await expect(detail.appVersionPill).toHaveText(/App version:\s+\d/);
        await expect(detail.networkTypePill).toHaveText(/Network type:\s+\S/);
        await expect(detail.copyAiContextButton).toBeVisible();

        await expect(detail.selectErrorPill(errorPill)).toBeVisible();
        await expect(detail.selectErrorPill(handledPill)).toBeVisible();

        await expect(detail.errorThreadStacktrace).toContainText(
          "trackHandledError",
        );
        await expect(detail.errorThreadStacktrace).toContainText("index.js");
      });

      test("session timeline renders the handled error event", async ({
        page,
        teamId,
      }) => {
        await overview.openErrorGroupByType(subtitle);
        const detail = new ErrorDetailPage(page, teamId);
        await detail.openSessionTimeline();
        const timeline = new SessionTimelinePage(page, teamId);

        await expect(timeline.eventsList).toBeVisible();
        const event = timeline.selectError(
          /Error: Simulated handled exception/,
        );
        await expect(event).toBeVisible();
        await expect(
          timeline.selectEventPill(event, "Handled Error"),
        ).toBeVisible();

        await event.click();
        await expect(timeline.eventDetails).toContainText(
          "Simulated handled exception",
        );
        await expect(timeline.eventDetails).toContainText("trackHandledError");
        await expect(timeline.eventDetails).toContainText("index.js");

        await timeline.openErrorDetails();
        await expect(detail.errorId).toHaveText(/Id:\s+[0-9a-fA-F-]{36}/);
      });
    });
  });
});
