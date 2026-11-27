// Record and replay of the SDK traffic an e2e run produces.
//
// Recording runs Frank against sessionator's recorder instead of the backend,
// so it needs a device but no stack. Replay sends the recorded requests to a
// fresh stack with timestamps moved to now, so it needs a stack but no device.
// A recording stays valid until the SDK, Frank or the Maestro flows change;
// recording-key.sh hashes exactly those.
//
// Layout of a recording directory:
//
//   manifest.json                 key, devices, per-spec Maestro result
//   <device>/build/<app>/...      PUT /builds captured while building Frank
//   <device>/specs/<spec>/<app>/  PUT /events captured during that spec's flow

import { execa, type ResultPromise } from "execa";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { capture, runOrThrow } from "./exec.ts";
import { log } from "./log.ts";
import type { Device } from "./setup-apps.ts";

export const RECORD_PORT = Number(process.env.RECORD_PORT ?? 18085);

export type Manifest = {
  key: string;
  createdAt: string;
  commit: string;
  // Spec name to whether its Maestro flow passed while recording.
  specs: Partial<Record<Device, Record<string, boolean>>>;
};

export function buildDir(dir: string, device: Device): string {
  return join(dir, device, "build");
}

export function specDir(dir: string, device: Device, spec: string): string {
  return join(dir, device, "specs", spec);
}

export async function recordingKey(repoRoot: string): Promise<string> {
  const key = await capture(repoRoot)`e2e-tests/recording-key.sh`;
  if (!key) throw new Error("e2e-tests/recording-key.sh failed");
  return key;
}

export function readManifest(dir: string): Manifest {
  const path = join(dir, "manifest.json");
  if (!existsSync(path)) throw new Error(`no recording at ${dir}`);
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

export function writeManifest(dir: string, manifest: Manifest): void {
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
}

// Builds sessionator once per run; `go run` per segment would recompile.
export async function buildSessionator(repoRoot: string): Promise<string> {
  const bin = join(repoRoot, "self-host/sessionator/sessionator-e2e");
  await runOrThrow(
    join(repoRoot, "self-host/sessionator"),
  )`go build -o ${bin} .`;
  return bin;
}

export class Recorder {
  private proc: ResultPromise | null = null;

  constructor(
    private bin: string,
    private sdkConfig: string,
  ) {}

  // Starts recording into outDir, replacing any recorder already running.
  async start(outDir: string): Promise<void> {
    await this.stop();
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    this.proc = execa(
      this.bin,
      [
        "record",
        "--path",
        outDir,
        "--port",
        String(RECORD_PORT),
        "--sdk-config",
        this.sdkConfig,
      ],
      { reject: false, stdio: "ignore", env: { GIN_MODE: "release" } },
    );
    await waitForPort(RECORD_PORT);
  }

  async stop(): Promise<void> {
    if (!this.proc) return;
    this.proc.kill("SIGTERM");
    await this.proc;
    this.proc = null;
  }
}

async function waitForPort(port: number): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      // Any HTTP answer, even a 404, means the server is up.
      await fetch(`http://localhost:${port}/`);
      return;
    } catch {
      await sleep(200);
    }
  }
  throw new Error(`recorder did not start on port ${port}`);
}

// The SDK batches and sends on its own schedule, so the last requests of a
// flow arrive after Maestro exits. Wait until the recording stops growing.
export async function waitForQuiet(
  dir: string,
  { quietMs = 15_000, maxMs = 120_000 } = {},
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (Date.now() - newestMtime(dir, start) >= quietMs) return;
    await sleep(1_000);
  }
  log.info(`recording in ${dir} still growing after ${maxMs / 1000}s`);
}

function newestMtime(dir: string, floor: number): number {
  let newest = floor;
  if (!existsSync(dir)) return newest;
  for (const entry of readdirSync(dir, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile()) continue;
    const m = statSync(join(entry.parentPath, entry.name)).mtimeMs;
    if (m > newest) newest = m;
  }
  return newest;
}

// Replays one spec: the device's build uploads plus that spec's events, into
// the app that apiKey belongs to.
export async function ingestSpec(
  bin: string,
  recording: string,
  device: Device,
  spec: string,
  apiKey: string,
  origin: string,
  workDir: string,
): Promise<void> {
  const label = `replay: ${device}:${spec}`;
  const src = join(workDir, `${device}-${spec}`);
  rmSync(src, { recursive: true, force: true });
  mkdirSync(src, { recursive: true });
  // sessionator uploads an app's builds only alongside its events, so both
  // go in one source tree.
  if (existsSync(buildDir(recording, device))) {
    cpSync(buildDir(recording, device), src, { recursive: true });
  }
  const events = specDir(recording, device, spec);
  if (!existsSync(events)) {
    log.scope(label).info("nothing recorded for this spec");
    return;
  }
  cpSync(events, src, { recursive: true });

  const apps = readdirSync(src, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const config = apps
    .map((app) => `[apps."${app}"]\napi-key = "${apiKey}"\n`)
    .join("\n");
  const configPath = join(workDir, `${device}-${spec}.toml`);
  writeFileSync(configPath, config);

  await runOrThrow(join(src), { label })`
    ${bin} ingest
    --source ${src}
    --config ${configPath}
    --origin ${origin}
    --rebase-time
    --build-process-delay 5s
  `;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
