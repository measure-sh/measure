import { type Locator, type Page } from "@playwright/test";

// Breakdown table columns, in render order: device memory tier, p50, p90,
// p95, sessions.
const breakdownPercentileColumn = { p50: 1, p90: 2, p95: 3 };

export class MemoryPage {
  readonly page: Page;
  readonly teamId: string;
  readonly plot: Locator;
  readonly plotNoData: Locator;
  readonly breakdown: Locator;
  readonly breakdownRow: Locator;
  readonly breakdownNoData: Locator;
  readonly highMemorySessions: Locator;
  readonly appImportanceSelect: Locator;

  constructor(page: Page, teamId: string) {
    this.page = page;
    this.teamId = teamId;
    this.plot = page.getByTestId("memory-usage-plot-data");
    this.plotNoData = page.getByTestId("memory-usage-plot-no-data");
    this.breakdown = page.getByTestId("memory-breakdown");
    this.breakdownRow = page.getByTestId("memory-breakdown-row");
    this.breakdownNoData = page.getByText("No memory samples found.");
    this.highMemorySessions = page.getByTestId("high-memory-sessions");
    // The selector shows the selected importance, so it is named after it.
    this.appImportanceSelect = page.getByRole("button", {
      name: /^(Foreground|User service|Background)$/,
    });
  }

  async goto(appId: string) {
    await this.page.goto(`/${this.teamId}/memory?a=${appId}`);
  }

  selectBreakdownHeader(label: string): Locator {
    return this.page.getByRole("columnheader", { name: label, exact: true });
  }

  selectBreakdownPercentile(
    row: Locator,
    percentile: keyof typeof breakdownPercentileColumn,
  ): Locator {
    return row.getByRole("cell").nth(breakdownPercentileColumn[percentile]);
  }

  async selectPercentile(percentile: string) {
    await this.page
      .getByRole("button", { name: percentile, exact: true })
      .click();
  }

  async selectAppImportance(importance: string) {
    await this.appImportanceSelect.click();
    await this.page
      .getByRole("option", { name: importance, exact: true })
      .click();
  }
}
