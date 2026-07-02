import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Device } from "./setup-apps.ts";

export type LastRun = {
  userId: string;
  authSessionId: string;
  teamId: string;
  appId: string;
};

function lastRunPath(repoRoot: string): string {
  return `${repoRoot}/e2e-tests/.last-run.json`;
}

function readAll(repoRoot: string): Partial<Record<Device, LastRun>> {
  const path = lastRunPath(repoRoot);
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as Partial<
    Record<Device, LastRun>
  >;
}

export function saveLastRun(
  repoRoot: string,
  device: Device,
  run: LastRun,
): void {
  const all = readAll(repoRoot);
  all[device] = run;
  writeFileSync(lastRunPath(repoRoot), JSON.stringify(all, null, 2) + "\n");
}

export function loadLastRun(repoRoot: string, device: Device): LastRun {
  const run = readAll(repoRoot)[device];
  if (!run) {
    throw new Error(
      `--no-build needs a saved last run for ${device}, but none exists. ` +
        `Run once without --no-build for ${device} first.`,
    );
  }
  return run;
}
