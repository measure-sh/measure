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
  assertBuildCaptured,
  buildDir,
  buildSessionator,
  ingestSpec,
  readManifest,
  Recorder,
  RECORD_PORT,
  recordingKey,
  specDir,
  waitForQuiet,
  writeManifest,
  type Manifest,
} from "./recording.ts";
import {
  createAppsViaDashboard,
  enableLogCollection,
  fetchAppIds,
  type AppKeys,
  type Device,
} from "./setup-apps.ts";

// These must match the values in self-host/.env.
const POSTGRES_DSN =
  "postgresql://postgres:postgres@localhost:5432/measure?search_path=measure";
const SESSION_ACCESS_SECRET =
  "super-secret-for-jwt-access-token-with-at-least-32-characters";
const SESSION_REFRESH_SECRET =
  "super-secret-for-jwt-refresh-token-with-at-least-32-characters";
const TOKEN_SECRETS = {
  accessTokenSecret: SESSION_ACCESS_SECRET,
  refreshTokenSecret: SESSION_REFRESH_SECRET,
};
const DASHBOARD_URL = "http://localhost:3000";
// Where Frank sends SDK traffic in a full run, so replay goes there too.
const INGEST_ORIGIN = "http://localhost:8080";

type Flags = {
  devices: Device[];
  showBrowser: boolean;
  seedGallery: boolean;
  notify: boolean;
  listSpecs: boolean;
  specs: string[];
  // Directory to record SDK traffic into, or to replay it from.
  record?: string;
  replay?: string;
  captureSdkConfig: boolean;
};

type PlatformResult = { platform: Device; passed: boolean };

type TestTarget = {
  device: Device;
  teamId: string;
  appId: string;
  apiKey: string;
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

  const selected = flags.specs.length === 0 ? specs : flags.specs;
  if (flags.record) {
    await record(flags.record, selected, repoRoot, flags);
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
    if (flags.captureSdkConfig) {
      await captureSdkConfig(repoRoot, targets[0]);
      return;
    }

    // Serial: the two Frank builds clash over the shared KMP build artifacts if
    // they run at once.
    const replay = flags.replay
      ? await openReplay(flags.replay, repoRoot)
      : null;
    for (const target of targets) {
      const { passed, failures, web } = replay
        ? await replayPlatform(target, selected, repoRoot, flags, replay)
        : await runPlatform(target, selected, repoRoot, flags);
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
    const maestroPassed = await runMaestro(target, spec, repoRoot, failures);
    if (!maestroPassed) {
      log
        .scope(`web: ${target.device}:${spec}`)
        .info("skipping Playwright tests because the Maestro flow failed");
      continue;
    }
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
  port = 8080,
): Promise<void> {
  const logger = log.scope(`build: ${device}`);
  const t = Date.now();
  if (device === "android") await buildAndInstallAndroid(repoRoot);
  else await buildAndInstallIOS(repoRoot);
  logger.ok(`Frank installed (${formatDuration(Date.now() - t)})`);
  if (device === "android") await ensureAdbReverse(repoRoot, port);
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
  if (!flags.replay) await writeFrankSecrets(repoRoot, keys);
  const appIds = await fetchAppIds(pool, account.teamId, flags.devices);
  await enableLogCollection(pool, appIds);

  return flags.devices.map((device) => ({
    device,
    teamId: account.teamId,
    appId: appIds[device]!,
    apiKey: keys[device]!,
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
  ingestUrl?: string,
): Promise<void> {
  log.info("writing samples/frank/.env");
  writeFrankEnv(repoRoot, keys, ingestUrl);
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
): Promise<boolean> {
  const device = target.device;
  const flowPath = `${repoRoot}/e2e-tests/maestro/specs/${spec}/${device}/main.yaml`;
  if (!existsSync(flowPath)) return true;
  const label = `maestro: ${device}:${spec}`;
  const logger = log.scope(label);
  logger.info("running flow");
  const t = Date.now();
  const ok = await run(repoRoot, {
    label,
  })`maestro ${maestroDeviceArgs(device)} test -e APP_ID=${FRANK_APP_ID[device]} ${flowPath}`;
  const dur = formatDuration(Date.now() - t);
  if (ok) logger.ok(`flow completed (${dur})`);
  else {
    logger.fail(`flow failed (${dur})`);
    failures.push(label);
  }
  return ok;
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

  const record = valueOf(args, "--record");
  const replay = valueOf(args, "--replay");
  if (record && replay) {
    throw new Error("--record and --replay are mutually exclusive");
  }
  const requested = args.filter(
    (a, i) =>
      !a.startsWith("-") &&
      args[i - 1] !== "--record" &&
      args[i - 1] !== "--replay",
  );
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
    record,
    replay,
    captureSdkConfig: args.includes("--capture-sdk-config"),
  };
}

// Saves the SDK config a freshly created e2e app gets, for the recorder to
// serve. Rerun when the config schema or the e2e app settings change.
async function captureSdkConfig(
  repoRoot: string,
  target: TestTarget,
): Promise<void> {
  const res = await fetch(`${INGEST_ORIGIN}/config`, {
    headers: { Authorization: `Bearer ${target.apiKey}` },
  });
  if (!res.ok) throw new Error(`GET /config: ${res.status}`);
  const config = (await res.json()) as unknown;
  const path = `${repoRoot}/e2e-tests/recording/sdk-config.json`;
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
  log.ok(`wrote ${path}`);
}

function valueOf(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const value = args[i + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} needs a directory`);
  }
  return resolve(value);
}

// Pins Maestro to ANDROID_SERIAL when set, so a run can share the host with
// other emulators.
function maestroDeviceArgs(device: Device): string[] {
  const serial = process.env.ANDROID_SERIAL;
  const args = [`--platform=${device}`];
  if (device === "android" && serial) args.push(`--device=${serial}`);
  return args;
}

// Records each spec's SDK traffic with no backend: Frank talks to
// sessionator's recorder, which answers like the ingest API and writes every
// request to disk. Replay later checks the dashboard against it.
async function record(
  dir: string,
  specs: string[],
  repoRoot: string,
  flags: Flags,
): Promise<void> {
  const runStart = Date.now();
  const manifest: Manifest = {
    key: await recordingKey(repoRoot),
    createdAt: new Date().toISOString(),
    commit: await gitCommit(repoRoot),
    specs: {},
  };
  const bin = await buildSessionator(repoRoot);
  const recorder = new Recorder(
    bin,
    `${repoRoot}/e2e-tests/recording/sdk-config.json`,
  );
  // The recorder ignores the key; the SDK only needs one to start.
  const keys: AppKeys = {};
  for (const d of flags.devices) keys[d] = "msrsh_e2e_recording";
  await writeFrankSecrets(repoRoot, keys, `http://localhost:${RECORD_PORT}`);

  try {
    for (const device of flags.devices) {
      const results: Record<string, boolean> = {};
      manifest.specs[device] = results;
      await bootDevice(device, repoRoot);
      try {
        await recorder.start(buildDir(dir, device), FRANK_APP_ID[device]);
        await buildAndInstall(device, repoRoot, RECORD_PORT);
        assertBuildCaptured(buildDir(dir, device));
        if (flags.seedGallery) await seedGallery(device, repoRoot);
        const target = { device } as TestTarget;
        for (const spec of specs) {
          const out = specDir(dir, device, spec);
          await recorder.start(out, FRANK_APP_ID[device]);
          results[spec] = await runMaestro(target, spec, repoRoot, []);
          await waitForQuiet(out);
        }
      } finally {
        await recorder.stop();
        await stopDevice(device);
      }
      writeManifest(dir, manifest);
    }
  } finally {
    await recorder.stop();
  }
  const failed = Object.entries(manifest.specs).flatMap(([d, r]) =>
    Object.entries(r)
      .filter(([, ok]) => !ok)
      .map(([s]) => `${d}:${s}`),
  );
  log.ok(
    `recorded ${dir} key=${manifest.key} in ${formatDuration(Date.now() - runStart)}`,
  );
  if (failed.length > 0) {
    log.fail(`Maestro failed while recording: ${failed.join(", ")}`);
    process.exit(1);
  }
}

type Replay = { dir: string; manifest: Manifest; bin: string; work: string };

async function openReplay(dir: string, repoRoot: string): Promise<Replay> {
  const manifest = readManifest(dir);
  const key = await recordingKey(repoRoot);
  if (manifest.key !== key && !process.env.E2E_ALLOW_STALE_RECORDING) {
    throw new Error(
      `recording ${dir} is for key ${manifest.key}, this commit needs ${key}; ` +
        "re-record with `npm start -- --record <dir>`",
    );
  }
  const bin = await buildSessionator(repoRoot);
  const work = `${tmpdir()}/measure-e2e-replay`;
  return { dir, manifest, bin, work };
}

// Replays each spec's recording into the fresh app, then runs its Playwright
// tests, mirroring runPlatform with ingest in place of the device.
async function replayPlatform(
  target: TestTarget,
  specs: string[],
  repoRoot: string,
  flags: Flags,
  replay: Replay,
): Promise<{ passed: boolean; failures: string[]; web?: WebResult }> {
  const failures: string[] = [];
  let web: WebResult | undefined;
  const recorded = replay.manifest.specs[target.device] ?? {};
  for (const spec of specs) {
    const label = `maestro: ${target.device}:${spec}`;
    if (!(spec in recorded)) {
      failures.push(`${label} (not in recording)`);
      continue;
    }
    if (!recorded[spec]) {
      log.scope(label).fail("flow failed while recording; skipping");
      failures.push(label);
      continue;
    }
    const t = Date.now();
    await ingestSpec(
      replay.bin,
      replay.dir,
      target.device,
      spec,
      target.apiKey,
      INGEST_ORIGIN,
      replay.work,
    );
    log
      .scope(`replay: ${target.device}:${spec}`)
      .ok(`ingested (${formatDuration(Date.now() - t)})`);
    const result = await runPlaywright(target, spec, repoRoot, flags, failures);
    if (result) web = addWebResult(web, result);
  }
  return { passed: failures.length === 0, failures, web };
}

function printHelp(): void {
  console.log(`Usage: npm start -- [spec...] [flags]

Flags:
  --android        run only the Android pipeline
  --ios            run only the iOS pipeline
  --specs          list the specs
  --seed-gallery   seed a gallery image (needed by bug_report)
  --record <dir>   record SDK traffic to <dir>; needs devices, no stack
  --replay <dir>   replay <dir> into a fresh stack; needs no devices
  --capture-sdk-config  save a fresh app's SDK config for --record
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
