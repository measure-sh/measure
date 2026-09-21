import { type Locator, type Page } from "@playwright/test";

export class SessionReplayOverviewPage {
  readonly page: Page;
  readonly teamId: string;
  readonly editAsTextButton: Locator;
  readonly filterText: Locator;
  readonly sessionRow: Locator;

  constructor(page: Page, teamId: string) {
    this.page = page;
    this.teamId = teamId;
    this.editAsTextButton = page.getByTestId("filter-toggle-text");
    this.filterText = page.getByTestId("filter-text");
    this.sessionRow = page.getByRole("link", { name: /^Session ID: / });
  }

  async goto(appId: string, filterExpr?: string) {
    const filter = filterExpr
      ? `&filter_expr=${encodeURIComponent(filterExpr)}`
      : "";
    await this.page.goto(`/${this.teamId}/session_replays?a=${appId}${filter}`);
  }

  // Writes the expression into the filter bar's text editor, where Enter
  // applies it. The bar stays in text mode afterwards, so a later filter only
  // switches when it is not already there. Wait for the applied filter to
  // reach the URL before asserting on results.
  async filter(filterExpr: string) {
    const editingAsText =
      await this.editAsTextButton.getAttribute("aria-pressed");
    if (editingAsText !== "true") await this.editAsTextButton.click();
    await this.filterText.fill(filterExpr);
    await this.filterText.press("Enter");
    await this.page.waitForURL(
      (url) => url.searchParams.get("filter_expr") === filterExpr,
    );
  }

  async openSession() {
    await this.sessionRow.first().click();
    await this.page.waitForURL("**/session_replays/**");
  }
}
