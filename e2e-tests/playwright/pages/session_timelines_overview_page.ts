import { type Locator, type Page } from "@playwright/test";

export class SessionTimelinesOverviewPage {
  readonly page: Page;
  readonly teamId: string;
  readonly freeText: Locator;
  readonly sessionRow: Locator;
  readonly matchedBadge: Locator;
  readonly moreFiltersButton: Locator;
  readonly saveFiltersButton: Locator;

  constructor(page: Page, teamId: string) {
    this.page = page;
    this.teamId = teamId;
    this.freeText = page.locator("#free-text");
    this.sessionRow = page.getByRole("link", { name: /^Session ID: / });
    this.matchedBadge = page.getByText(/^Matched /);
    this.moreFiltersButton = page.getByRole("button", { name: "More filters" });
    this.saveFiltersButton = page.getByRole("button", { name: "Save" });
  }

  async goto(appId: string) {
    await this.page.goto(`/${this.teamId}/session_timelines?a=${appId}`);
  }

  // Wait for the debounced query to reach the URL before asserting on results.
  async search(term: string) {
    await this.freeText.fill(term);
    await this.page.waitForURL((url) => url.href.includes(term));
  }

  async filterBySessionType(sessionType: string) {
    await this.moreFiltersButton.click();
    await this.page
      .getByRole("checkbox", { name: sessionType, exact: true })
      .click();
    await this.saveFiltersButton.click();
  }

  async openSession() {
    await this.sessionRow.first().click();
    await this.page.waitForURL("**/session_timelines/**");
  }
}
