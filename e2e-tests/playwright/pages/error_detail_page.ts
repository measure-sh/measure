import { type Locator, type Page } from "@playwright/test";

export class ErrorDetailPage {
  readonly page: Page;
  readonly teamId: string;
  readonly errorId: Locator;
  readonly errorInstancesPlot: Locator;
  readonly attributeDistributionPlot: Locator;
  readonly commonPathSection: Locator;
  readonly errorThreadStacktrace: Locator;
  readonly timestampPill: Locator;
  readonly devicePill: Locator;
  readonly appVersionPill: Locator;
  readonly networkTypePill: Locator;
  readonly sessionReplayLink: Locator;
  readonly copyAiContextButton: Locator;
  readonly userDefinedAttribute: Locator;
  readonly screenshot: Locator;
  readonly threadHeaders: Locator;
  readonly subject: Locator;

  constructor(page: Page, teamId: string) {
    this.page = page;
    this.teamId = teamId;
    this.errorId = page.getByTestId("exception-detail-id");
    this.errorInstancesPlot = page.getByTestId("exception-detail-plot-data");
    this.attributeDistributionPlot = page.getByTestId(
      "exception-distribution-plot-data",
    );
    this.commonPathSection = page.getByTestId("exception-detail-common-path");
    this.errorThreadStacktrace = page.getByTestId(
      "exception-detail-main-stacktrace",
    );
    this.timestampPill = page.getByTestId("exception-detail-timestamp");
    this.devicePill = page.getByTestId("exception-detail-device");
    this.appVersionPill = page.getByTestId("exception-detail-app-version");
    this.networkTypePill = page.getByTestId("exception-detail-network-type");
    this.sessionReplayLink = page.getByRole("link", {
      name: "View Session Replay",
    });
    this.copyAiContextButton = page.getByRole("button", {
      name: "Copy AI Context",
    });
    this.userDefinedAttribute = page
      .getByTestId("exception-detail-attribute")
      .filter({ hasText: "user_defined_attribute" });
    this.screenshot = page.getByAltText(/^Screenshot/);
    this.threadHeaders = page.getByRole("button", { name: /^Thread:/ });
    this.subject = page
      .getByTestId("exception-detail-attribute")
      .filter({ hasText: "subject" });
  }

  selectThread(name: string | RegExp): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }

  // The accordion renders threads in order, so a thread's rank is its
  // index among the headers. Reading it back this way keeps assertions
  // about ordering from silently becoming assertions about layout.
  async threadRank(name: RegExp): Promise<number> {
    const names = await this.threadHeaders.allTextContents();
    return names.findIndex((text) => name.test(text));
  }

  // An accordion's content is a region labelled by the trigger that
  // opens it, so a thread's stack is addressable by the same name.
  selectThreadStacktrace(name: string | RegExp): Locator {
    return this.page.getByRole("region", { name, exact: true });
  }

  selectErrorPill(label: string): Locator {
    return this.page
      .getByTestId("exception-detail-pills")
      .getByText(label, { exact: true });
  }

  async openSessionReplay() {
    await this.sessionReplayLink.click();
    await this.page.waitForURL(`**/${this.teamId}/session_replays/**`);
  }
}
