import { type Locator, type Page } from "@playwright/test";

export class ErrorsOverviewPage {
  readonly page: Page;
  readonly teamId: string;
  readonly errorGroupRow: Locator;

  constructor(page: Page, teamId: string) {
    this.page = page;
    this.teamId = teamId;
    this.errorGroupRow = page.getByTestId("exception-row");
  }

  selectErrorGroupRowByType(type: RegExp): Locator {
    return this.errorGroupRow.filter({
      has: this.page.getByTestId("exception-row-type").filter({
        hasText: type,
      }),
    });
  }

  selectErrorGroupRowByTitle(title: RegExp): Locator {
    return this.errorGroupRow.filter({ hasText: title });
  }

  selectGroupRowTitle(row: Locator, title: string): Locator {
    return row.getByText(title, { exact: true });
  }

  selectGroupRowPill(row: Locator, label: string): Locator {
    return row.getByText(label, { exact: true });
  }

  selectGroupRowPercentageContribution(row: Locator): Locator {
    return row.getByRole("cell", { name: /%$/ });
  }

  async gotoFatalErrors(appId: string) {
    await this.goto(appId, "Crash");
  }

  async gotoHandledErrors(appId: string) {
    await this.goto(appId, "Handled Error");
  }

  async gotoUnhandledErrors(appId: string) {
    await this.goto(appId, "Unhandled Error");
  }

  async gotoAnrs(appId: string) {
    await this.goto(appId, "ANR");
  }

  private async goto(appId: string, errorType: string) {
    const filter = encodeURIComponent(`error_type:in:"${errorType}"`);
    await this.page.goto(
      `/${this.teamId}/errors?a=${appId}&filter_expr=${filter}`,
    );
  }

  async openErrorGroup(row: Locator) {
    await row.click();
    await this.page.waitForURL(`**/${this.teamId}/errors/**`);
  }

  async openErrorGroupByType(type: RegExp) {
    await this.openErrorGroup(this.selectErrorGroupRowByType(type));
  }
}
