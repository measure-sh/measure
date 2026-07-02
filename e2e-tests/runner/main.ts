import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { run, runOrThrow } from "./exec.ts";
import {
  buildAndInstallAndroid,
  buildAndInstallIOS,
  ensureAdbReverse,
  writeFrankEnv,
} from "./frank.ts";
import { type LastRun, loadLastRun, saveLastRun } from "./last-run.ts";
import { formatDuration, log } from "./log.ts";
import { createAccount, createSessionTokens } from "./account.ts";
import {
  createAppsViaDashboard,
  fetchAppIds,
  type AppKeys,
  type Device,
} from "./setup-apps.ts";

const FRANK_APP_ID: Record<Device, string> = {
  android: "sh.frankenstein.android",
  ios: "sh.frankenstein.ios.debug",
};

// IMPORTANT: The constants below must match
// what's in your self-host/.env.
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
  noBuild: boolean;
  listSpecs: boolean;
  specs: string[];
};

type TestTarget = {
  device: Device;
  teamId: string;
  appId: string;
  accessToken: string;
  refreshToken: string;
  lastRun?: LastRun;
};

async function main() {
  const runStart = Date.now();
  const repoRoot = resolve(process.cwd(), "..");

  const specs = discoverSpecs(repoRoot);
  const flags = parseArgs(process.argv.slice(2), specs);
  if (!flags) return;

  if (flags.listSpecs) {
    console.log(specLines(specs));
    return;
  }

  const pool = new pg.Pool({ connectionString: POSTGRES_DSN });
  await checkPrerequisites(pool, flags.devices);

  const shouldBuild = !flags.noBuild;
  const targets = shouldBuild
    ? await createTargets(pool, repoRoot, flags)
    : reuseTargets(repoRoot, flags.devices);
  await Promise.all(
    targets.map((target) =>
      prepareTarget(target, repoRoot, flags, shouldBuild),
    ),
  );

  printDashboardHint(repoRoot, targets[0]);

  const selected = flags.specs.length === 0 ? specs : flags.specs;
  const failures = await runSpecs(targets, selected, repoRoot, flags);

  await pool.end();
  printSummary(failures, runStart);
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

async function runSpecs(
  targets: TestTarget[],
  specs: string[],
  repoRoot: string,
  flags: Flags,
): Promise<string[]> {
  const failures: string[] = [];
  for (const target of targets) {
    for (const spec of specs) {
      await runMaestro(target, spec, repoRoot, failures);
      await runPlaywright(target, spec, repoRoot, flags, failures);
    }
  }
  return failures;
}

async function prepareTarget(
  target: TestTarget,
  repoRoot: string,
  flags: Flags,
  shouldBuild: boolean,
): Promise<void> {
  const device = target.device;
  const logger = log.scope(`build: ${device}`);

  if (!shouldBuild) {
    logger.info("skipping build; using already-installed Frank");
  } else {
    const t = Date.now();
    if (device === "android") await buildAndInstallAndroid(repoRoot);
    else await buildAndInstallIOS(repoRoot);
    logger.ok(`Frank installed (${formatDuration(Date.now() - t)})`);
    if (target.lastRun) saveLastRun(repoRoot, device, target.lastRun);
  }

  if (device === "android") await ensureAdbReverse(repoRoot);

  if (flags.seedGallery) await seedGallery(device, repoRoot);
}

function reuseTargets(repoRoot: string, devices: Device[]): TestTarget[] {
  return devices.map((device) => {
    const last = loadLastRun(repoRoot, device);
    const tokens = createSessionTokens(
      last.userId,
      last.authSessionId,
      TOKEN_SECRETS,
    );
    log.ok(`reused last run for ${device}: team_id=${last.teamId}`);
    return { device, teamId: last.teamId, appId: last.appId, ...tokens };
  });
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

  return flags.devices.map((device) => {
    const appId = appIds[device]!;
    return {
      device,
      teamId: account.teamId,
      appId,
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      lastRun: {
        userId: account.userId,
        authSessionId: account.authSessionId,
        teamId: account.teamId,
        appId,
      },
    };
  });
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
): Promise<void> {
  const device = target.device;
  const label = `web: ${device}:${spec}`;
  const logger = log.scope(label);
  logger.info("running Playwright tests");
  writePlaywrightStorageState(repoRoot, target);

  const env: NodeJS.ProcessEnv = {
    TEAM_ID: target.teamId,
    SITE_BASE: DASHBOARD_URL,
    APP_ID: target.appId,
  };
  if (flags.showBrowser) env.SHOW_BROWSER = "1";

  const t = Date.now();
  const ok = await run(`${repoRoot}/e2e-tests`, {
    env,
    label,
  })`npx playwright test playwright/specs/${spec} --config playwright/playwright.config.ts --project=${device}`;
  const dur = formatDuration(Date.now() - t);
  if (ok) logger.ok(`web tests passed (${dur})`);
  else {
    logger.fail(`web tests failed (${dur})`);
    failures.push(label);
  }
}

function discoverSpecs(repoRoot: string): string[] {
  const specsDir = `${repoRoot}/e2e-tests/playwright/specs`;
  return readdirSync(specsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

const SPEC_DESCRIPTIONS: Record<string, string> = {
  bug_report:
    "File a bug report on each framework, then verify it in the dashboard.",
  errors:
    "Raise fatal, handled, unhandled and ANR errors, then verify each error group.",
  session_timeline:
    "Emit http, trace, gesture and custom events, then verify the session timeline.",
};

function specLines(specs: string[]): string {
  const width = Math.max(...specs.map((s) => s.length));
  return specs
    .map((s) => `  ${s.padEnd(width)}  ${SPEC_DESCRIPTIONS[s] ?? ""}`.trimEnd())
    .join("\n");
}

function parseArgs(args: string[], specs: string[]): Flags | null {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp(specs);
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
    noBuild: args.includes("--no-build"),
    listSpecs: args.includes("--specs"),
    specs: requested,
  };
}

function printHelp(specs: string[]): void {
  console.log(`Usage: npm start -- [spec...] [flags]

Specs:
${specLines(specs)}

Flags:
  --android        run only the Android pipeline
  --ios            run only the iOS pipeline
  --no-build       reuse the installed Frank and last run's team (skip rebuild)
  --specs          list the specs
  --seed-gallery   seed a gallery image (needed by bug_report)
  --show-browser   show the browser during dashboard steps
  --verbose, -v    stream subprocess output live
  --help, -h       show this help`);
}

function printSummary(failures: string[], runStart: number): void {
  const total = formatDuration(Date.now() - runStart);
  if (failures.length > 0) {
    log.fail(`${failures.length} flow(s) failed in ${total}:`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  log.ok(`all flows passed in ${total}`);
}

async function checkPrerequisites(
  pool: pg.Pool,
  devices: Device[],
): Promise<void> {
  try {
    const client = await pool.connect();
    client.release();
  } catch {
    log.fatal(
      "Postgres is unreachable on localhost:5432. Is the self-host stack up? Start it with 'cd self-host && docker compose up'.",
    );
  }
  log.ok("postgres reachable on localhost:5432");

  try {
    const res = await fetch(`${DASHBOARD_URL}/`);
    if (res.status >= 500) throw new Error(`status ${res.status}`);
  } catch {
    log.fatal(
      "Dashboard is unreachable on localhost:3000. Is the self-host stack up? Start it with 'cd self-host && docker compose up'.",
    );
  }
  log.ok("dashboard reachable on localhost:3000");

  if (devices.includes("android")) {
    const result = spawnSync("adb", ["devices"], { encoding: "utf8" });
    const attached = (result.stdout ?? "")
      .split("\n")
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l.endsWith("\tdevice"));
    if (attached.length === 0) {
      log.fatal(
        "No Android devices found via adb. Boot an emulator or connect a device.",
      );
    }
    log.ok(`found ${attached.length} android device(s) via adb`);
  }

  if (devices.includes("ios")) {
    const result = spawnSync("xcrun", ["simctl", "list", "devices", "booted"], {
      encoding: "utf8",
    });
    if (!(result.stdout ?? "").includes("Booted")) {
      log.fatal(
        "No booted iOS Simulator found. Open Simulator.app and boot one.",
      );
    }
    log.ok("found a booted ios simulator");
  }
}

main().catch((err) => {
  log.fail(err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
