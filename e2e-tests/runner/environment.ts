import { execa } from "execa";
import { existsSync } from "node:fs";
import { once } from "node:events";
import { runOrThrow } from "./exec.ts";
import { formatDuration, log } from "./log.ts";
import { type Device } from "./setup-apps.ts";

export const FRANK_APP_ID: Record<Device, string> = {
  android: "sh.frankenstein.android",
  ios: "sh.frankenstein.ios.debug",
};

// A freshly booted device reports ready before it has fully settled; give it a
// moment so the first tap and install land reliably.
const DEVICE_SETTLE_MS = 15_000;

const EMULATOR_FLAGS = [
  "-no-window",
  "-no-snapshot",
  "-gpu",
  "swiftshader_indirect",
  "-no-audio",
  "-no-boot-anim",
];

function composeFile(repoRoot: string): string {
  return `${repoRoot}/self-host/compose.yml`;
}

export async function ensureDocker(repoRoot: string): Promise<void> {
  const logger = log.scope("docker");
  if (await dockerRunning()) {
    logger.info("daemon already running");
    return;
  }
  logger.info("daemon down, starting it");
  const startedAt = Date.now();
  if (await installed("colima")) await runOrThrow(repoRoot)`colima start`;
  else await runOrThrow(repoRoot)`open -a Docker`;
  await waitUntil("docker daemon", dockerRunning);
  logger.ok(`daemon ready (${formatDuration(Date.now() - startedAt)})`);
}

// compose down then up; `down` keeps the named volumes, so data is not lost.
export async function startStack(repoRoot: string): Promise<void> {
  const logger = log.scope("self-host");
  const compose = composeFile(repoRoot);
  if (!existsSync(compose)) {
    throw new Error(
      `self-host compose file not found at ${compose}; ` +
        `has self-host been set up? See self-host/README.`,
    );
  }
  logger.info("starting self-host");
  const startedAt = Date.now();
  await runOrThrow(
    repoRoot,
  )`docker compose -f ${compose} --profile migrate down --remove-orphans`;
  await runOrThrow(
    repoRoot,
  )`docker compose -f ${compose} --profile migrate up -d --build --wait`;
  logger.ok(`self-host ready (${formatDuration(Date.now() - startedAt)})`);
}

export async function stopStack(repoRoot: string): Promise<void> {
  log.scope("self-host").info("stopping self-host");
  await quiet("docker", [
    "compose",
    "-f",
    composeFile(repoRoot),
    "--profile",
    "migrate",
    "down",
    "--remove-orphans",
  ]);
}

export function bootDevice(device: Device, repoRoot: string): Promise<void> {
  return device === "android" ? bootAndroid(repoRoot) : bootIos(repoRoot);
}

export function stopDevice(device: Device): Promise<void> {
  return device === "android" ? stopAndroid() : stopIos();
}

async function bootAndroid(repoRoot: string): Promise<void> {
  const logger = log.scope("android");
  const avd = process.env.ANDROID_AVD ?? "";
  if (await androidAttached()) {
    logger.info("device already attached");
  } else {
    if (!avd) {
      throw new Error(
        "no Android device attached and ANDROID_AVD is unset; set it in " +
          "e2e-tests/.env (list AVDs with `emulator -list-avds`)",
      );
    }
    logger.info(`booting emulator ${avd}`);
    const startedAt = Date.now();
    await launchEmulator(avd);
    await runOrThrow(repoRoot)`adb wait-for-device`;
    await waitUntil("emulator boot", androidBooted);
    logger.ok(`emulator booted (${formatDuration(Date.now() - startedAt)})`);
    logger.info("letting emulator settle");
    await sleep(DEVICE_SETTLE_MS);
  }

  // A lower versionCode than a prior install blocks `adb install -r`; uninstall
  // so the build goes on fresh.
  logger.info("removing any previously installed app");
  await quiet("adb", ["uninstall", FRANK_APP_ID.android]);

  // Gboard's stylus-handwriting sheet swallows the bug_report text input.
  const stylus = ["shell", "settings", "put", "secure"];
  await quiet("adb", [...stylus, "stylus_handwriting_enabled", "0"]);
  await quiet("adb", [...stylus, "stylus_handwriting_default_value", "0"]);
}

async function bootIos(repoRoot: string): Promise<void> {
  const logger = log.scope("ios");
  const simulator = process.env.IOS_SIMULATOR ?? "";
  if (await iosBooted()) {
    logger.info("simulator already booted");
  } else {
    if (!simulator) {
      throw new Error(
        "no iOS simulator booted and IOS_SIMULATOR is unset; set it in " +
          "e2e-tests/.env (list with `xcrun simctl list devices`)",
      );
    }
    logger.info(`booting simulator ${simulator}`);
    const startedAt = Date.now();
    await runOrThrow(repoRoot)`xcrun simctl boot ${simulator}`;
    await runOrThrow(repoRoot)`xcrun simctl bootstatus ${simulator} -b`;
    logger.ok(`simulator booted (${formatDuration(Date.now() - startedAt)})`);
    logger.info("letting simulator settle");
    await sleep(DEVICE_SETTLE_MS);
  }

  logger.info("removing any previously installed app");
  await quiet("xcrun", ["simctl", "uninstall", "booted", FRANK_APP_ID.ios]);
  await runOrThrow(repoRoot)`open -a Simulator`;
}

async function stopAndroid(): Promise<void> {
  log.scope("android").info("stopping emulators");
  const result = await execa("adb", ["devices"], { reject: false });
  const emulators = deviceLines(result.stdout)
    .map((line) => line.split("\t")[0])
    .filter((id) => id.startsWith("emulator-"));
  for (const id of emulators) await quiet("adb", ["-s", id, "emu", "kill"]);
}

async function stopIos(): Promise<void> {
  log.scope("ios").info("stopping simulator");
  await quiet("xcrun", [
    "simctl",
    "shutdown",
    process.env.IOS_SIMULATOR ?? "all",
  ]);
}

// Launches the emulator detached so it keeps running through the tests. Awaits
// the spawn so a launch failure (e.g. emulator not on PATH) throws cleanly here
// instead of crashing the run with an unhandled rejection.
async function launchEmulator(avd: string): Promise<void> {
  const emulator = execa("emulator", ["-avd", avd, ...EMULATOR_FLAGS], {
    detached: true,
    stdio: "ignore",
  });
  emulator.unref();
  emulator.catch(() => {});
  await once(emulator, "spawn");
}

async function androidAttached(): Promise<boolean> {
  const result = await execa("adb", ["devices"], { reject: false });
  return deviceLines(result.stdout).length > 0;
}

async function androidBooted(): Promise<boolean> {
  const result = await execa(
    "adb",
    ["shell", "getprop", "sys.boot_completed"],
    {
      reject: false,
    },
  );
  return result.stdout.trim() === "1";
}

async function iosBooted(): Promise<boolean> {
  const result = await execa("xcrun", ["simctl", "list", "devices", "booted"], {
    reject: false,
  });
  return result.stdout.includes("Booted");
}

// `adb devices` lines that are ready, e.g. "emulator-5554\tdevice".
function deviceLines(adbDevicesOutput: string): string[] {
  return adbDevicesOutput
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.endsWith("\tdevice"));
}

async function dockerRunning(): Promise<boolean> {
  return succeeds("docker", ["info"]);
}

async function installed(command: string): Promise<boolean> {
  return succeeds("which", [command]);
}

async function succeeds(file: string, args: string[]): Promise<boolean> {
  const result = await execa(file, args, { reject: false, stdio: "ignore" });
  return result.exitCode === 0;
}

async function quiet(file: string, args: string[]): Promise<void> {
  await execa(file, args, { reject: false, stdio: "ignore" });
}

async function waitUntil(
  what: string,
  ready: () => Promise<boolean>,
  attempts = 60,
  delayMs = 2000,
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    if (await ready()) return;
    await sleep(delayMs);
  }
  const waited = formatDuration(attempts * delayMs);
  throw new Error(`timed out after ${waited} waiting for ${what}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}
