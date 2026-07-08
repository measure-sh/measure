import { type Locator, type Page } from "@playwright/test";

export class BugReportDetailPage {
  readonly page: Page;
  readonly teamId: string;
  readonly description: Locator;
  readonly status: Locator;
  readonly statusToggleButton: Locator;
  readonly screenshots: Locator;
  readonly sessionTimelineLink: Locator;
  readonly userIdPill: Locator;
  readonly timestampPill: Locator;
  readonly devicePill: Locator;
  readonly appVersionPill: Locator;
  readonly networkTypePill: Locator;

  constructor(page: Page, teamId: string) {
    this.page = page;
    this.teamId = teamId;
    this.description = page.getByTestId("bug-report-detail-description");
    this.status = page.getByTestId("bug-report-detail-status");
    this.userIdPill = page.getByTestId("bug-report-detail-user-id");
    this.timestampPill = page.getByTestId("bug-report-detail-timestamp");
    this.devicePill = page.getByTestId("bug-report-detail-device");
    this.appVersionPill = page.getByTestId("bug-report-detail-app-version");
    this.networkTypePill = page.getByTestId("bug-report-detail-network-type");
    this.statusToggleButton = page.getByRole("button", {
      name: /(Close|Re-Open) Bug Report/,
    });
    this.screenshots = page.getByRole("img", { name: /^Screenshot \d+$/ });
    this.sessionTimelineLink = page.getByRole("link", {
      name: "View Session Timeline",
    });
  }

  renderedScreenshotCount(): Promise<number> {
    return this.screenshots.evaluateAll(
      (imgs) =>
        imgs.filter((img) => (img as HTMLImageElement).naturalWidth > 0).length,
    );
  }

  async openSessionTimeline() {
    await this.sessionTimelineLink.click();
    await this.page.waitForURL(`**/${this.teamId}/session_timelines/**`);
  }
}
