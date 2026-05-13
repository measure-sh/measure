#!/usr/bin/env node
/**
 * End-to-end smoke test for content negotiation across every marketing,
 * docs, and non-public route. For each URL we make two requests:
 *
 *   1. With no Accept header — expect HTML (page.tsx rendering).
 *   2. With Accept: text/markdown — expect a 200 markdown response for
 *      routes that have a page.md or a docs/*.md source, and 406 for
 *      routes that intentionally have no markdown twin (legal pages,
 *      auth, dashboard).
 *
 * Runs against a live dashboard (defaults to http://localhost:3000).
 * Exits non-zero if any check fails and prints a failure summary.
 *
 * Usage:
 *   node scripts/smoke_test_pages.js
 *   BASE=https://measure.sh node scripts/smoke_test_pages.js
 */

const BASE = process.env.BASE || "http://localhost:3000";

let pass = 0;
let fail = 0;
const failures = [];

async function check(url, mode, expectStatus, expectCtype, expectBodyRe) {
  const headers = {};
  if (mode !== "html") {
    headers.Accept = "text/markdown";
  }

  let status;
  let ctype = "";
  let body = "";
  try {
    const res = await fetch(`${BASE}${url}`, { headers, redirect: "manual" });
    status = res.status;
    ctype = res.headers.get("content-type") || "";
    body = await res.text();
  } catch (err) {
    status = "ERR";
    ctype = err.message;
  }

  let ok = true;
  let why = "";
  if (String(status) !== String(expectStatus)) {
    ok = false;
    why = `status=${status} (want ${expectStatus})`;
  } else if (!ctype.includes(expectCtype)) {
    ok = false;
    why = `content-type=${ctype} (want ${expectCtype})`;
  } else if (
    expectBodyRe &&
    !new RegExp(expectBodyRe).test(body.slice(0, 4096))
  ) {
    ok = false;
    why = `body did not match /${expectBodyRe}/`;
  }

  const label = `  ${ok ? "PASS" : "FAIL"} ${url.padEnd(58)} [${mode}] `;
  if (ok) {
    pass++;
    console.log(label + status);
  } else {
    fail++;
    failures.push(`${url} [${mode}] — ${why}`);
    console.log(label + why);
  }
}

// Marketing pages: have a colocated page.md, expect markdown in both modes
const MARKETING_URLS = [
  "/",
  "/about",
  "/why-measure",
  "/pricing",
  "/security",
  "/crashlytics-alternatives",
  "/product/adaptive-capture",
  "/product/app-health",
  "/product/bug-reports",
  "/product/crashes-and-anrs",
  "/product/mcp",
  "/product/network-performance",
  "/product/performance-traces",
  "/product/session-timelines",
  "/product/user-journeys",
];

// Legal pages: intentionally no page.md, markdown mode must 406
const LEGAL_URLS = ["/privacy-policy", "/terms-of-service"];

// Docs: every slug Next.js can resolve from content/docs/ — kept exhaustive
// so removing a doc fails the test and forces a list update.
const DOCS_URLS = [
  "/docs",
  "/docs/sdk-integration-guide",
  "/docs/faqs",
  "/docs/versioning",
  "/docs/CONTRIBUTING",
  "/docs/features/configuration-options",
  "/docs/features/feature-data-retention",
  "/docs/features/performance-impact",
  "/docs/features/feature-session-timelines",
  "/docs/features/feature-crash-reporting",
  "/docs/features/feature-anr-reporting",
  "/docs/features/feature-error-tracking",
  "/docs/features/feature-gesture-tracking",
  "/docs/features/feature-performance-tracing",
  "/docs/features/feature-custom-events",
  "/docs/features/feature-bug-report-android",
  "/docs/features/feature-bug-report-ios",
  "/docs/features/feature-bug-report-flutter",
  "/docs/features/feature-screenshot-masking-swiftui",
  "/docs/features/feature-app-launch-metrics",
  "/docs/features/feature-network-monitoring",
  "/docs/features/feature-network-connectivity-changes",
  "/docs/features/feature-navigation-lifecycle-tracking",
  "/docs/features/feature-cpu-monitoring",
  "/docs/features/feature-memory-monitoring",
  "/docs/features/feature-identify-users",
  "/docs/features/feature-manually-start-stop-sdk",
  "/docs/features/feature-app-size-monitoring",
  "/docs/features/feature-alerts",
  "/docs/features/feature-slack-integration",
  "/docs/features/feature-mcp",
  "/docs/sdk-upgrade-guides",
  "/docs/sdk-upgrade-guides/android-v0.16.0",
  "/docs/sdk-upgrade-guides/ios-v0.9.0",
  "/docs/sdk-upgrade-guides/measure_flutter-v0.4.0",
  "/docs/hosting",
  "/docs/hosting/google-oauth",
  "/docs/hosting/github-oauth",
  "/docs/hosting/smtp-email",
  "/docs/hosting/slack",
  "/docs/hosting/migration-guides",
  "/docs/hosting/migration-guides/v0.4.x",
  "/docs/hosting/migration-guides/v0.6.x",
  "/docs/hosting/migration-guides/v0.8.x",
  "/docs/hosting/migration-guides/v0.9.x",
  "/docs/hosting/migration-guides/v0.10.x",
  "/docs/api",
  "/docs/api/sdk",
  "/docs/api/dashboard",
];

// Non-marketing routes: page.tsx exists but no page.md is authored.
// Markdown mode must 406; HTML mode must still serve the page. The
// dashboard route uses an arbitrary teamId — the page is reachable
// (auth is checked client-side after the initial render).
const NON_PUBLIC_URLS = ["/auth/login", "/some-team/overview"];

async function main() {
  console.log(`Smoke testing ${BASE}\n`);

  console.log("=== Marketing pages — HTML mode ===");
  for (const u of MARKETING_URLS) {
    await check(u, "html", 200, "text/html", "(<!DOCTYPE|<html)");
  }

  console.log("\n=== Marketing pages — markdown mode ===");
  for (const u of MARKETING_URLS) {
    await check(u, "md", 200, "text/markdown", "^#");
  }

  console.log("\n=== Legal pages — HTML mode (should be 200) ===");
  for (const u of LEGAL_URLS) {
    await check(u, "html", 200, "text/html", "(<!DOCTYPE|<html)");
  }

  console.log("\n=== Legal pages — markdown mode (should be 406) ===");
  for (const u of LEGAL_URLS) {
    await check(u, "md-406", 406, "text/plain", "No markdown representation");
  }

  console.log("\n=== Docs pages — HTML mode ===");
  for (const u of DOCS_URLS) {
    await check(u, "html", 200, "text/html", "(<!DOCTYPE|<html)");
  }

  console.log("\n=== Docs pages — markdown mode ===");
  for (const u of DOCS_URLS) {
    await check(u, "md", 200, "text/markdown", "^#");
  }

  console.log("\n=== Non-public routes — HTML mode (page.tsx renders) ===");
  for (const u of NON_PUBLIC_URLS) {
    await check(u, "html", 200, "text/html", "(<!DOCTYPE|<html)");
  }

  console.log("\n=== Non-public routes — markdown mode (no page.md → 406) ===");
  for (const u of NON_PUBLIC_URLS) {
    await check(u, "md-406", 406, "text/plain", "No markdown representation");
  }

  console.log("\n=============================================");
  console.log(`Summary: PASS=${pass}  FAIL=${fail}`);
  if (fail > 0) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
