import { type Locator, type Page } from "@playwright/test";

export class BugReportsOverviewPage {
  readonly page: Page;
  readonly teamId: string;
  readonly bugReportRow: Locator;
  readonly bugReportsPlot: Locator;

  constructor(page: Page, teamId: string) {
    this.page = page;
    this.teamId = teamId;
    this.bugReportRow = page.getByTestId("bug-report-row");
    this.bugReportsPlot = page.getByTestId("bug-reports-plot-data");
  }

  selectBugReportRowByDescription(description: string): Locator {
    return this.bugReportRow.filter({
      has: this.page.getByTestId("bug-report-row-description").filter({
        hasText: description,
      }),
    });
  }

  async goto(appId: string) {
    await this.page.goto(`/${this.teamId}/bug_reports?a=${appId}`);
  }

  async openBugReport(description: string) {
    await this.selectBugReportRowByDescription(description).first().click();
    await this.page.waitForURL(`**/${this.teamId}/bug_reports/**`);
  }
}
