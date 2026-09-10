import { type Locator, type Page } from "@playwright/test";

export class MemoryPage {
  readonly page: Page;
  readonly teamId: string;
  readonly trendSection: Locator;
  readonly sessionsSection: Locator;
  readonly sessionRow: Locator;

  constructor(page: Page, teamId: string) {
    this.page = page;
    this.teamId = teamId;
    this.trendSection = page.getByTestId("memory-trend-section");
    this.sessionsSection = page.getByTestId("memory-sessions-section");
    this.sessionRow = page.getByTestId("memory-session-row");
  }

  async goto(appId: string) {
    await this.page.goto(`/${this.teamId}/memory?a=${appId}`);
  }

  selectSessionRowContaining(text: string | RegExp): Locator {
    return this.sessionRow.filter({ hasText: text });
  }
}
