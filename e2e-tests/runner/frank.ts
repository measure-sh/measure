import { writeFileSync } from "node:fs";
import { runOrThrow } from "./exec.ts";
import { log } from "./log.ts";
import type { AppKeys } from "./setup-apps.ts";

const INGEST_URL = "http://localhost:8080";

export function writeFrankEnv(repoRoot: string, keys: AppKeys): void {
  const lines: string[] = [];
  if (keys.android) {
    lines.push(`FRANK_MEASURE_ANDROID_API_KEY_DEBUG=${keys.android}`);
    lines.push(`FRANK_MEASURE_ANDROID_API_URL_DEBUG=${INGEST_URL}`);
    lines.push(`FRANK_MEASURE_ANDROID_API_KEY_RELEASE=${keys.android}`);
    lines.push(`FRANK_MEASURE_ANDROID_API_URL_RELEASE=${INGEST_URL}`);
  }
  if (keys.ios) {
    lines.push(`FRANK_MEASURE_IOS_API_KEY_DEBUG=${keys.ios}`);
    lines.push(`FRANK_MEASURE_IOS_API_URL_DEBUG=${INGEST_URL}`);
    lines.push(`FRANK_MEASURE_IOS_API_KEY_RELEASE=${keys.ios}`);
    lines.push(`FRANK_MEASURE_IOS_API_URL_RELEASE=${INGEST_URL}`);
  }
  writeFileSync(`${repoRoot}/samples/frank/.env`, lines.join("\n") + "\n");
}

export async function buildAndInstallAndroid(repoRoot: string): Promise<void> {
  const label = "build: android";
  const logger = log.scope(label);
  const frankDir = `${repoRoot}/samples/frank`;
  logger.info("assembling Frankenstein Android (release)");
  await runOrThrow(frankDir, { label })`./gradlew :android:app:assembleRelease`;
  const apk = `${frankDir}/android/app/build/outputs/apk/release/app-release.apk`;
  logger.info(`installing Frankenstein Android via adb: ${apk}`);
  await runOrThrow(repoRoot, { label })`adb install -r ${apk}`;
}

// Forward device:localhost:8080 → host:localhost:8080 so the SDK and the Gradle
// plugin share one ingest origin.
export async function ensureAdbReverse(repoRoot: string): Promise<void> {
  const label = "build: android";
  const logger = log.scope(label);
  logger.info("forwarding ingest port 8080 to host via adb reverse");
  await runOrThrow(repoRoot, { label })`adb reverse tcp:8080 tcp:8080`;
}

export async function buildAndInstallIOS(repoRoot: string): Promise<void> {
  const label = "build: ios";
  const logger = log.scope(label);
  const iosDir = `${repoRoot}/samples/frank/ios`;
  const hostArch = process.arch === "arm64" ? "arm64" : "x86_64";
  logger.info("building Frankenstein iOS (debug)");
  await runOrThrow(iosDir, { label })`
    xcodebuild
    -workspace FrankensteinApp.xcworkspace
    -scheme FrankensteinApp
    -configuration Debug
    -destination ${"generic/platform=iOS Simulator"}
    -derivedDataPath build
    CODE_SIGNING_ALLOWED=NO
    ARCHS=${hostArch}
    ONLY_ACTIVE_ARCH=YES
    clean build
  `;
  const appPath = `${iosDir}/build/Build/Products/Debug-iphonesimulator/FrankensteinApp.app`;
  logger.info(`installing Frankenstein iOS via simctl: ${appPath}`);
  await runOrThrow(repoRoot, { label })`xcrun simctl install booted ${appPath}`;
}
