import { type Locator, type Page } from "@playwright/test";

export class MemoryPage {
  readonly page: Page;
  readonly teamId: string;
  readonly trendSection: Locator;
  readonly sessionsSection: Locator;
  readonly sessionRow: Locator;
  readonly sessionRamTier: Locator;

  constructor(page: Page, teamId: string) {
    this.page = page;
    this.teamId = teamId;
    this.trendSection = page.getByTestId("memory-trend-section");
    this.sessionsSection = page.getByTestId("memory-sessions-section");
    this.sessionRow = page.getByTestId("memory-session-row");
    this.sessionRamTier = page.getByTestId("memory-session-ram-tier");
  }

  async goto(appId: string) {
    await this.page.goto(`/${this.teamId}/memory?a=${appId}`);
  }

  async gotoFilteredByRamTier(appId: string, ramTierValue: string) {
    const filterExpr = encodeURIComponent(`session_ram_tier:in:${ramTierValue}`);
    await this.page.goto(
      `/${this.teamId}/memory?a=${appId}&filter_expr=${filterExpr}`,
    );
  }

  selectSessionRowContaining(text: string | RegExp): Locator {
    return this.sessionRow.filter({ hasText: text });
  }
}

// Matches memory_sessions_table.tsx's ramTierLabel() display strings, mapped
// back to the session_ram_tier filter's enum values
// (backend/libs/exprfilter/entity.go) — used to derive a real filter value
// from whatever RAM tier the test device actually reports, instead of
// hardcoding one tier for every environment this spec might run in.
export function ramTierLabelToFilterValue(label: string): string {
  const map: Record<string, string> = {
    "0–4 GB": "0-4gb",
    "4 GB": "4gb",
    "6 GB": "6gb",
    "8 GB": "8gb",
    "12 GB": "12gb",
    "16 GB": "16gb",
    "16 GB+": "16gb+",
  };
  const value = map[label];
  if (!value) throw new Error(`Unrecognized RAM tier label: ${label}`);
  return value;
}
