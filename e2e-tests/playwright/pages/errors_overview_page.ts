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

  // iOS reports every exception under its terminating signal (e.g. SIGABRT),
  // so the type cannot tell native, Flutter, and KMP rows apart. Callers
  // disambiguate on the row title, which is the relevant frame's file:method.
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
    await this.page.goto(`/${this.teamId}/errors?a=${appId}&et=error&sv=fatal`);
  }

  async gotoHandledErrors(appId: string) {
    await this.page.goto(
      `/${this.teamId}/errors?a=${appId}&et=error&sv=handled`,
    );
  }

  async gotoUnhandledErrors(appId: string) {
    await this.page.goto(
      `/${this.teamId}/errors?a=${appId}&et=error&sv=unhandled`,
    );
  }

  async gotoAnrs(appId: string) {
    await this.page.goto(`/${this.teamId}/errors?a=${appId}&et=anr`);
  }

  async openErrorGroup(row: Locator) {
    await row.click();
    await this.page.waitForURL(`**/${this.teamId}/errors/**`);
  }

  async openErrorGroupByType(type: RegExp) {
    await this.openErrorGroup(this.selectErrorGroupRowByType(type));
  }
}
