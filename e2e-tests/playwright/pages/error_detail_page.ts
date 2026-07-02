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
  readonly sessionTimelineLink: Locator;
  readonly copyAiContextButton: Locator;
  readonly userDefinedAttribute: Locator;
  readonly screenshot: Locator;

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
    this.sessionTimelineLink = page.getByRole("link", {
      name: "View Session Timeline",
    });
    this.copyAiContextButton = page.getByRole("button", {
      name: "Copy AI Context",
    });
    this.userDefinedAttribute = page
      .getByTestId("exception-detail-attribute")
      .filter({ hasText: "user_defined_attribute" });
    this.screenshot = page.getByAltText(/^Screenshot/);
  }

  selectErrorPill(label: string): Locator {
    return this.page
      .getByTestId("exception-detail-pills")
      .getByText(label, { exact: true });
  }

  async openSessionTimeline() {
    await this.sessionTimelineLink.click();
    await this.page.waitForURL(`**/${this.teamId}/session_timelines/**`);
  }
}
