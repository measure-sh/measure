import { chromium, type Page } from "@playwright/test";
import type pg from "pg";

export type Device = "android" | "ios";
export type AppKeys = Partial<Record<Device, string>>;
export type AppIds = Partial<Record<Device, string>>;

export async function createAppsViaDashboard(
  teamId: string,
  dashboardUrl: string,
  storageStatePath: string,
  devices: Device[],
  opts: { showBrowser: boolean },
): Promise<AppKeys> {
  const browser = await chromium.launch({ headless: !opts.showBrowser });
  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();

  try {
    const keys: AppKeys = {};
    for (const device of devices) {
      const name = `frank-${device}`;
      await page.goto(`${dashboardUrl}/${teamId}/apps`);
      const onboardingInput = page.getByTestId("onboarding-app-name-input");
      const apiKeyInput = page.getByTestId("api-key-input");
      const flow = await Promise.race([
        onboardingInput
          .waitFor({ state: "visible", timeout: 30_000 })
          .then(() => "onboarding" as const),
        apiKeyInput
          .waitFor({ state: "visible", timeout: 30_000 })
          .then(() => "settings" as const),
      ]);
      if (flow === "onboarding") {
        await createAppViaOnboarding(page, name);
        await page.goto(`${dashboardUrl}/${teamId}/apps`);
      } else {
        await createAppViaDialog(page, name);
      }
      keys[device] = await waitForApiKey(page);
    }
    return keys;
  } finally {
    await browser.close();
  }
}

async function createAppViaOnboarding(page: Page, name: string): Promise<void> {
  const input = page.getByTestId("onboarding-app-name-input");
  await input.fill(name);
  await page.getByTestId("onboarding-create-app-button").click();
  await input.waitFor({ state: "detached", timeout: 15_000 });
}

async function createAppViaDialog(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Create App", exact: true }).click();
  const input = page.getByPlaceholder("Enter app name");
  await input.fill(name);
  await input.press("Enter");
  await input.waitFor({ state: "detached", timeout: 15_000 });
}

async function waitForApiKey(page: Page): Promise<string> {
  return page.getByTestId("api-key-input").inputValue({ timeout: 15_000 });
}

// Automatic log collection is off by default (log_autocollect_enabled=false),
// so enable it for the test apps. log_min_severity=8 (debug) lets every
// severity through, so the flow can exercise the full debug..fatal range.
export async function enableLogCollection(
  pool: pg.Pool,
  appIds: AppIds,
): Promise<void> {
  const ids = Object.values(appIds).filter((id): id is string => !!id);
  if (ids.length === 0) return;
  await pool.query(
    "update sdk_config set log_autocollect_enabled = true, log_min_severity = 8 where app_id = any($1)",
    [ids],
  );
}

export async function fetchAppIds(
  pool: pg.Pool,
  teamId: string,
  devices: Device[],
): Promise<AppIds> {
  const res = await pool.query<{ id: string; app_name: string }>(
    "select id, app_name from apps where team_id = $1",
    [teamId],
  );
  const ids: AppIds = {};
  for (const device of devices) {
    const row = res.rows.find((r) => r.app_name === `frank-${device}`);
    if (!row) {
      throw new Error(
        `fetchAppIds: expected frank-${device} in team ${teamId}, got ${JSON.stringify(res.rows)}`,
      );
    }
    ids[device] = row.id;
  }
  return ids;
}
