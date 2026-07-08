import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { tmpdir } from "node:os";
import pg from "pg";
import { capture, run, runOrThrow } from "./exec.ts";
import {
  bootDevice,
  ensureDocker,
  FRANK_APP_ID,
  startStack,
  stopDevice,
  stopStack,
} from "./environment.ts";
import {
  buildAndInstallAndroid,
  buildAndInstallIOS,
  ensureAdbReverse,
  writeFrankEnv,
} from "./frank.ts";
import { formatDuration, log } from "./log.ts";
import { createAccount } from "./account.ts";
import {
  addWebResult,
  parseReport,
  type WebResult,
  type WebResultsByDevice,
} from "./playwright-result.ts";
import {
  createAppsViaDashboard,
  fetchAppIds,
  type AppKeys,
  type Device,
} from "./setup-apps.ts";

// These must match the values in self-host/.env.
const POSTGRES_DSN =
  "postgresql://postgres:postgres@localhost:5432/measure?search_path=measure";
const SESSION_ACCESS_SECRET =
  "super-secret-for-jwt-token-with-at-least-32-characters";
const SESSION_REFRESH_SECRET =
  "super-secret-for-jwt-token-with-at-least-32-characters";
const TOKEN_SECRETS = {
  accessTokenSecret: SESSION_ACCESS_SECRET,
  refreshTokenSecret: SESSION_REFRESH_SECRET,
};
const DASHBOARD_URL = "http://localhost:3000";

type Flags = {
  devices: Device[];
  showBrowser: boolean;
  seedGallery: boolean;
  notify: boolean;
  listSpecs: boolean;
  specs: string[];
};

type PlatformResult = { platform: Device; passed: boolean };

type TestTarget = {
  device: Device;
  teamId: string;
  appId: string;
  accessToken: string;
  refreshToken: string;
};

async function main() {
  const runStart = Date.now();
  const repoRoot = resolve(process.cwd(), "..");
  loadRunnerEnv(repoRoot);

  const specs = discoverSpecs(repoRoot);
  const flags = parseArgs(process.argv.slice(2), specs);
  if (!flags) return;

  if (flags.listSpecs) {
    console.log(specs.join("\n"));
    return;
  }

  const webhook = flags.notify ? (process.env.NOTIFY_WEBHOOK ?? "") : "";
  const commit = await gitCommit(repoRoot);
  const pool = new pg.Pool({ connectionString: POSTGRES_DSN });
  const results: PlatformResult[] = [];
  const allFailures: string[] = [];
  const webResults: WebResultsByDevice = {};
  let failed = false;

  try {
    await ensureDocker(repoRoot);
    await startStack(repoRoot);
    const targets = await createTargets(pool, repoRoot, flags);
    printDashboardHint(repoRoot, targets[0]);

    // Serial: the two Frank builds clash over the shared KMP build artifacts if
    // they run at once.
    const selected = flags.specs.length === 0 ? specs : flags.specs;
    for (const target of targets) {
      const { passed, failures, web } = await runPlatform(
        target,
        selected,
        repoRoot,
        flags,
      );
      results.push({ platform: target.device, passed });
      allFailures.push(...failures);
      if (web) webResults[target.device] = web;
    }

    await reportAndNotify(
      results,
      allFailures,
      webResults,
      webhook,
      runStart,
      commit,
    );
    failed = results.some((r) => !r.passed);
  } catch (err) {
    failed = true;
    const message = err instanceof Error ? err.message : String(err);
    log.fail(message);
    if (err instanceof Error && err.stack) console.error(err.stack);
    const elapsed = formatDuration(Date.now() - runStart);
    await notify(
      webhook,
      buildReport(false, elapsed, commit, [summarizeError(message)]),
    );
  } finally {
    await stopStack(repoRoot);
    await pool.end().catch(() => {});
  }

  if (failed) process.exit(1);
}

// Runner config (ANDROID_AVD, IOS_SIMULATOR) lives in a git-ignored .env.
function loadRunnerEnv(repoRoot: string): void {
  const envFile = `${repoRoot}/e2e-tests/.env`;
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

function printDashboardHint(repoRoot: string, target: TestTarget): void {
  writePlaywrightStorageState(repoRoot, target);
  const url = `${DASHBOARD_URL}/${target.teamId}/overview`;
  console.log();
  console.log("Open the dashboard to watch results:");
  console.log(
    `  npx playwright open --load-storage=playwright/.storage-state.json ${url}`,
  );
  console.log();
}

async function runSpecsForTarget(
  target: TestTarget,
  specs: string[],
  repoRoot: string,
  flags: Flags,
): Promise<{ failures: string[]; web?: WebResult }> {
  const failures: string[] = [];
  let web: WebResult | undefined;
  for (const spec of specs) {
    await runMaestro(target, spec, repoRoot, failures);
    const result = await runPlaywright(target, spec, repoRoot, flags, failures);
    if (result) web = addWebResult(web, result);
  }
  return { failures, web };
}

// Boots this platform's device, builds and runs against it, then stops the
// device whether the run passed or threw.
async function runPlatform(
  target: TestTarget,
  specs: string[],
  repoRoot: string,
  flags: Flags,
): Promise<{ passed: boolean; failures: string[]; web?: WebResult }> {
  await bootDevice(target.device, repoRoot);
  try {
    await buildAndInstall(target.device, repoRoot);
    if (flags.seedGallery) await seedGallery(target.device, repoRoot);
    const { failures, web } = await runSpecsForTarget(
      target,
      specs,
      repoRoot,
      flags,
    );
    return { passed: failures.length === 0, failures, web };
  } finally {
    await stopDevice(target.device);
  }
}

async function buildAndInstall(
  device: Device,
  repoRoot: string,
): Promise<void> {
  const logger = log.scope(`build: ${device}`);
  const t = Date.now();
  if (device === "android") await buildAndInstallAndroid(repoRoot);
  else await buildAndInstallIOS(repoRoot);
  logger.ok(`Frank installed (${formatDuration(Date.now() - t)})`);
  if (device === "android") await ensureAdbReverse(repoRoot);
}

async function createTargets(
  pool: pg.Pool,
  repoRoot: string,
  flags: Flags,
): Promise<TestTarget[]> {
  log.info("creating fresh user and team");
  const t = Date.now();
  const account = await createAccount(pool, TOKEN_SECRETS);
  log.ok(
    `created team_id=${account.teamId} (${formatDuration(Date.now() - t)})`,
  );

  const storageStatePath = writePlaywrightStorageState(repoRoot, account);
  const keys = await createApps(account.teamId, storageStatePath, flags);
  await writeFrankSecrets(repoRoot, keys);
  const appIds = await fetchAppIds(pool, account.teamId, flags.devices);

  return flags.devices.map((device) => ({
    device,
    teamId: account.teamId,
    appId: appIds[device]!,
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
  }));
}

function writePlaywrightStorageState(
  repoRoot: string,
  auth: { accessToken: string; refreshToken: string },
): string {
  const storageStatePath = `${repoRoot}/e2e-tests/playwright/.storage-state.json`;
  const cookieBase = {
    domain: "localhost",
    path: "/",
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: "Lax" as const,
  };
  writeFileSync(
    storageStatePath,
    JSON.stringify({
      cookies: [
        { name: "access_token", value: auth.accessToken, ...cookieBase },
        { name: "refresh_token", value: auth.refreshToken, ...cookieBase },
      ],
      origins: [],
    }),
  );
  return storageStatePath;
}

async function createApps(
  teamId: string,
  storageStatePath: string,
  flags: Flags,
): Promise<AppKeys> {
  log.info("creating apps via dashboard UI");
  const t = Date.now();
  const keys = await createAppsViaDashboard(
    teamId,
    DASHBOARD_URL,
    storageStatePath,
    flags.devices,
    { showBrowser: flags.showBrowser },
  );
  const summary = flags.devices
    .map((device) => `${device}=${keys[device]?.slice(0, 14)}…`)
    .join(", ");
  log.ok(`apps created: ${summary} (${formatDuration(Date.now() - t)})`);
  return keys;
}

async function writeFrankSecrets(
  repoRoot: string,
  keys: AppKeys,
): Promise<void> {
  log.info("writing samples/frank/.env");
  writeFrankEnv(repoRoot, keys);
  await runOrThrow(repoRoot)`samples/frank/setup-secrets.sh`;
}

async function seedGallery(device: Device, repoRoot: string): Promise<void> {
  const label = `seed: ${device}`;
  const logger = log.scope(label);
  const imagePath = `${repoRoot}/e2e-tests/maestro/assets/test_image.png`;
  logger.info("seeding gallery image");
  const t = Date.now();
  if (device === "android") {
    const devicePath = "/sdcard/Pictures/measure-e2e-test.png";
    await runOrThrow(repoRoot, { label })`adb push ${imagePath} ${devicePath}`;
    await runOrThrow(repoRoot, {
      label,
    })`adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d ${`file://${devicePath}`}`;
  } else {
    await runOrThrow(repoRoot, {
      label,
    })`xcrun simctl addmedia booted ${imagePath}`;
  }
  logger.ok(`gallery seeded (${formatDuration(Date.now() - t)})`);
}

async function runMaestro(
  target: TestTarget,
  spec: string,
  repoRoot: string,
  failures: string[],
): Promise<void> {
  const device = target.device;
  const flowPath = `${repoRoot}/e2e-tests/maestro/specs/${spec}/${device}/main.yaml`;
  if (!existsSync(flowPath)) return;
  const label = `maestro: ${device}:${spec}`;
  const logger = log.scope(label);
  logger.info("running flow");
  const t = Date.now();
  const ok = await run(repoRoot, {
    label,
  })`maestro --platform=${device} test -e APP_ID=${FRANK_APP_ID[device]} ${flowPath}`;
  const dur = formatDuration(Date.now() - t);
  if (ok) logger.ok(`flow completed (${dur})`);
  else {
    logger.fail(`flow failed (${dur})`);
    failures.push(label);
  }
}

async function runPlaywright(
  target: TestTarget,
  spec: string,
  repoRoot: string,
  flags: Flags,
  failures: string[],
): Promise<WebResult | null> {
  const device = target.device;
  const label = `web: ${device}:${spec}`;
  const logger = log.scope(label);
  logger.info("running Playwright tests");
  writePlaywrightStorageState(repoRoot, target);

  const reportPath = `${tmpdir()}/measure-e2e-${device}-${spec}.json`;
  const env: NodeJS.ProcessEnv = {
    TEAM_ID: target.teamId,
    SITE_BASE: DASHBOARD_URL,
    APP_ID: target.appId,
    PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
  };
  if (flags.showBrowser) env.SHOW_BROWSER = "1";

  const t = Date.now();
  const ok = await run(`${repoRoot}/e2e-tests`, {
    env,
    label,
  })`npx playwright test playwright/specs/${spec} --config playwright/playwright.config.ts --project=${device}`;
  const dur = formatDuration(Date.now() - t);

  // The exit code is the source of truth; a missing report only costs summary
  // detail, so never let it fail the run.
  let web: WebResult | null = null;
  try {
    web = parseReport(reportPath);
  } catch {
    logger.info(
      "could not read Playwright json report; skipping result detail",
    );
  }

  if (ok) logger.ok(`web tests passed (${dur})`);
  else {
    logger.fail(`web tests failed (${dur})`);
    failures.push(label);
  }
  return web;
}

function discoverSpecs(repoRoot: string): string[] {
  const specsDir = `${repoRoot}/e2e-tests/playwright/specs`;
  return readdirSync(specsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function parseArgs(args: string[], specs: string[]): Flags | null {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return null;
  }
  const onlyAndroid = args.includes("--android");
  const onlyIos = args.includes("--ios");
  if (onlyAndroid && onlyIos) {
    throw new Error("--android and --ios are mutually exclusive");
  }
  const devices: Device[] = [];
  if (!onlyIos) devices.push("android");
  if (!onlyAndroid) devices.push("ios");

  const requested = args.filter((a) => !a.startsWith("-"));
  const unknown = requested.filter((s) => !specs.includes(s));
  if (unknown.length > 0) {
    throw new Error(
      `unknown spec(s): ${unknown.join(", ")}. ` +
        `Valid: ${specs.join(", ")} (or run with --specs).`,
    );
  }
  return {
    devices,
    showBrowser: args.includes("--show-browser"),
    seedGallery: args.includes("--seed-gallery"),
    notify: args.includes("--notify"),
    listSpecs: args.includes("--specs"),
    specs: requested,
  };
}

function printHelp(): void {
  console.log(`Usage: npm start -- [spec...] [flags]

Flags:
  --android        run only the Android pipeline
  --ios            run only the iOS pipeline
  --specs          list the specs
  --seed-gallery   seed a gallery image (needed by bug_report)
  --notify         post a Slack summary at the end
  --show-browser   show the browser during dashboard steps
  --verbose, -v    stream subprocess output live
  --help, -h       show this help`);
}

async function reportAndNotify(
  results: PlatformResult[],
  allFailures: string[],
  webResults: WebResultsByDevice,
  webhook: string,
  runStart: number,
  commit: string,
): Promise<void> {
  const total = formatDuration(Date.now() - runStart);
  for (const { platform, passed } of results) {
    if (passed) log.ok(`${platform}: passed`);
    else log.fail(`${platform}: failed`);
  }

  const failed = results.filter((r) => !r.passed).map((r) => r.platform);
  const passed = failed.length === 0;
  if (passed) {
    log.ok(`run passed in ${total}`);
  } else {
    log.fail(`run failed in ${total}: ${failed.join(", ")} failed`);
    for (const f of allFailures) console.log(`  - ${f}`);
  }

  const body = platformLines(results, webResults);
  await notify(webhook, buildReport(passed, total, commit, body));
}

// Short SHA and subject of the commit under test, e.g. "abc1234 test: …".
async function gitCommit(repoRoot: string): Promise<string> {
  return capture(repoRoot)`git show -s ${"--format=%h %s"} HEAD`;
}

function buildReport(
  passed: boolean,
  duration: string,
  commit: string,
  body: string[],
): string {
  const header = passed ? "✅ e2e PASSED" : "❌ e2e FAILED";
  const lines = [`${header} in ${duration}`];
  if (commit) lines.push(commit);
  if (body.length > 0) lines.push("", ...body);
  if (process.env.LOG_FILE) {
    lines.push("", `log: ${basename(process.env.LOG_FILE)}`);
  }
  return lines.join("\n");
}

function platformLines(
  results: PlatformResult[],
  webResults: WebResultsByDevice,
): string[] {
  const lines: string[] = [];
  for (const { platform, passed } of results) {
    const mark = passed ? "✓" : "✗";
    const web = webResults[platform];
    if (!web) {
      lines.push(`${mark} ${platform}`);
      continue;
    }
    const counts =
      web.failed > 0
        ? `${web.passed} passed, ${web.failed} failed`
        : `${web.passed} passed`;
    lines.push(`${mark} ${platform}: ${counts}`);
    for (const test of web.tests) {
      if (!test.ok) lines.push(`    ✗ ${test.title}`);
    }
  }
  return lines;
}

function summarizeError(message: string): string {
  const lines = message.split("\n").map((line) => line.trim());
  const summary = lines[0];
  const waitingFor = lines.find((line) => line.startsWith("- waiting for"));
  if (!waitingFor) return summary;
  return `${summary} (${waitingFor.replace("- ", "")})`;
}

async function notify(webhook: string, text: string): Promise<void> {
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    log.info("warning: notify webhook failed");
  }
}

main().catch((err) => {
  log.fail(err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
