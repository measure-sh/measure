import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const showBrowser = process.env.SHOW_BROWSER === "1";

// Every spec runs for every project. Platform-only tests are tagged
// @android / @ios; each project filters out the other platform's tag.
export default defineConfig({
  testDir: "./specs",
  // One worker: spec files otherwise run on parallel workers, and concurrent
  // suites overload the local dashboard into page.goto timeouts.
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  expect: { timeout: 5_000 },
  projects: [
    { name: "android", grepInvert: /@ios/ },
    { name: "ios", grepInvert: /@android/ },
  ],
  use: {
    baseURL: process.env.SITE_BASE ?? "http://localhost:3000",
    storageState: resolve(here, ".storage-state.json"),
    headless: !showBrowser,
    trace: "retain-on-failure",
  },
});
