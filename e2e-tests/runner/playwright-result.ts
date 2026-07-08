import { readFileSync } from "node:fs";
import type { Device } from "./setup-apps.ts";

export type TestResult = { title: string; ok: boolean };

export type WebResult = {
  passed: number;
  failed: number;
  tests: TestResult[];
};

export type WebResultsByDevice = Partial<Record<Device, WebResult>>;

type PlaywrightReport = {
  stats?: { expected?: number; unexpected?: number };
  suites?: ReportSuite[];
};
type ReportSuite = {
  title?: string;
  specs?: ReportSpec[];
  suites?: ReportSuite[];
};
type ReportSpec = { title?: string; ok?: boolean };

export function parseReport(jsonFilePath: string): WebResult {
  const report = JSON.parse(
    readFileSync(jsonFilePath, "utf8"),
  ) as PlaywrightReport;
  return {
    passed: report.stats?.expected ?? 0,
    failed: report.stats?.unexpected ?? 0,
    tests: collectTests(report.suites ?? [], []),
  };
}

// Full title path (file › describe… › test) so same-named tests across
// frameworks stay distinct.
function collectTests(
  suites: ReportSuite[],
  ancestors: string[],
): TestResult[] {
  const tests: TestResult[] = [];
  for (const suite of suites) {
    const path = suite.title ? [...ancestors, suite.title] : ancestors;
    for (const spec of suite.specs ?? []) {
      tests.push({
        title: [...path, spec.title ?? "(untitled)"].join(" › "),
        ok: spec.ok !== false,
      });
    }
    tests.push(...collectTests(suite.suites ?? [], path));
  }
  return tests;
}

// Playwright runs once per spec, so fold each spec's totals together.
export function addWebResult(
  prior: WebResult | undefined,
  next: WebResult,
): WebResult {
  const base = prior ?? { passed: 0, failed: 0, tests: [] };
  return {
    passed: base.passed + next.passed,
    failed: base.failed + next.failed,
    tests: [...base.tests, ...next.tests],
  };
}
