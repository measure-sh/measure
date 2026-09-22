import { describe, expect, it } from "@jest/globals";
import { DateTime } from "luxon";
import { handleSandboxRequest } from "@/app/sandbox/handlers";
import { catalog } from "@/app/sandbox/catalog";
import type { AppBundle } from "@/app/sandbox/catalog";
import { DEVICE_MEMORY_TIERS } from "@/app/sandbox/device_memory";
import type {
  HighMemoryUsageSession,
  HighMemoryUsageSessionsResponse,
  MemoryUsageBreakdownRow,
  MemoryUsagePlotPoint,
} from "@/app/api/api_calls";

const world = catalog();
const MB = 1024;

function bundleFor(os: string): AppBundle {
  const bundle = Array.from(world.appById.values()).find(
    (b) => b.scenario.app.os === os,
  );
  if (!bundle) {
    throw new Error(`no ${os} app in the sandbox catalog`);
  }
  return bundle;
}

const android = bundleFor("android");
const ios = bundleFor("ios");

function weekParams(extra: Record<string, string> = {}): string {
  const to = DateTime.now();
  return new URLSearchParams({
    from: to.minus({ days: 7 }).toISO()!,
    to: to.toISO()!,
    timezone: "UTC",
    plot_time_group: "days",
    ...extra,
  }).toString();
}

const EMPTY_RANGE =
  "from=1990-01-01T00:00:00.000Z&to=1990-01-02T00:00:00.000Z&timezone=UTC&plot_time_group=days";

async function get<T>(path: string): Promise<T> {
  const res = await handleSandboxRequest(path);
  expect(res.status).toBe(200);
  return (await res.json()) as T;
}

function plotPath(bundle: AppBundle, extra: Record<string, string> = {}) {
  return `/api/apps/${bundle.app.id}/memory/plots/usage?${weekParams(extra)}`;
}

function breakdownPath(bundle: AppBundle, extra: Record<string, string> = {}) {
  return `/api/apps/${bundle.app.id}/memory/plots/breakdown?${weekParams(extra)}`;
}

function highUsagePath(bundle: AppBundle, extra: Record<string, string> = {}) {
  return `/api/apps/${bundle.app.id}/memory/sessions/high-usage?${weekParams({
    limit: "50",
    offset: "0",
    ...extra,
  })}`;
}

function versionLabels(bundle: AppBundle): string[] {
  return bundle.scenario.app.versions.map((v) => `${v.name} (${v.code})`);
}

function expectOrderedPercentiles(point: {
  p50: number | null;
  p90: number | null;
  p95: number | null;
  p99?: number | null;
}) {
  expect(point.p50).toBeGreaterThan(0);
  expect(point.p90).toBeGreaterThanOrEqual(point.p50!);
  expect(point.p95).toBeGreaterThanOrEqual(point.p90!);
  if (point.p99 !== undefined) {
    expect(point.p99).toBeGreaterThanOrEqual(point.p95!);
  }
}

function expectSessionRow(bundle: AppBundle, row: HighMemoryUsageSession) {
  const session = bundle.sessions.find(
    (s) => s.list.session_id === row.session_id,
  );
  expect(session).toBeDefined();
  expect(row.app_id).toBe(bundle.app.id);
  expect(row.first_event_time).toBe(session!.list.first_event_time);
  expect(row.last_event_time).toBe(session!.list.last_event_time);
  expect(row.peak_memory_kb).toBeGreaterThan(0);
  expect(row.attribute).toEqual({
    app_version: session!.detail.attribute.app_version,
    app_build: session!.detail.attribute.app_build,
    device_name: session!.detail.attribute.device_name,
    device_model: session!.detail.attribute.device_model,
    device_manufacturer: session!.detail.attribute.device_manufacturer,
    device_total_memory: session!.detail.attribute.device_total_memory,
    os_name: session!.detail.attribute.os_name,
    os_version: session!.detail.attribute.os_version,
  });
}

describe.each([
  ["android", android],
  ["ios", ios],
])("memory routes for the %s app", (os, bundle) => {
  it("plots one point per version and day with percentiles in KB", async () => {
    const points = await get<MemoryUsagePlotPoint[]>(plotPath(bundle));
    const labels = versionLabels(bundle);
    expect(points.length).toBe(8 * labels.length);
    expect(new Set(points.map((p) => p.version))).toEqual(new Set(labels));
    for (const point of points) {
      expect(point.datetime).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expectOrderedPercentiles(point);
      // A phone app's heap is tens to hundreds of MB, so a value in bytes or MB would fall outside.
      expect(point.p50).toBeGreaterThan(20 * MB);
      expect(point.p99).toBeLessThan(2000 * MB);
      expect(point.sample_count).toBeGreaterThan(0);
    }
    const days = points.map((p) => p.datetime);
    expect(days).toEqual([...days].sort());
    const again = await get<MemoryUsagePlotPoint[]>(plotPath(bundle));
    expect(again).toEqual(points);
  });

  it("breaks usage down by device memory tier in ascending order", async () => {
    const rows = await get<MemoryUsageBreakdownRow[]>(breakdownPath(bundle));
    expect(rows.length).toBeGreaterThan(1);
    const order = rows.map((r) =>
      DEVICE_MEMORY_TIERS.indexOf(r.device_total_memory_tier),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const row of rows) {
      expectOrderedPercentiles(row);
      expect(row.session_count).toBeGreaterThan(0);
      expect(row.sample_count).toBeGreaterThanOrEqual(row.session_count);
    }
  });

  it("lists real sessions with high memory usage, ordered by severity, in the platform's shape", async () => {
    const page = await get<HighMemoryUsageSessionsResponse>(
      highUsagePath(bundle),
    );
    const results = page.results ?? [];
    expect(results.length).toBeGreaterThan(1);
    expect(page.meta).toEqual({ next: false, previous: false });
    const severities = results.map((row) =>
      os === "android"
        ? row.percent_of_target!
        : row.peak_memory_limit_utilization!,
    );
    expect(severities).toEqual([...severities].sort((a, b) => b - a));
    for (const row of results) {
      expectSessionRow(bundle, row);
      if (os === "android") {
        expect(row.target_memory_kb).toBeGreaterThan(0);
        expect(row.percent_of_target).toBeGreaterThanOrEqual(75);
        expect(row.percent_of_target).toBeCloseTo(
          (row.peak_memory_kb * 100) / row.target_memory_kb!,
          6,
        );
        expect(row.peak_memory_limit_utilization).toBeUndefined();
        const peak = Math.max(
          ...bundle.sessions
            .find((s) => s.list.session_id === row.session_id)!
            .detail.memory_usage!.map((m) => Number(m.dynamic_memory)),
        );
        expect(row.peak_memory_kb).toBe(peak);
      } else {
        expect(row.peak_memory_limit_utilization).toBeGreaterThanOrEqual(0.75);
        expect(row.peak_memory_limit_utilization).toBeLessThanOrEqual(1);
        expect(row.available_memory_at_peak_utilization_kb).toBeGreaterThan(0);
        expect(row.target_memory_kb).toBeUndefined();
        expect(row.percent_of_target).toBeUndefined();
      }
    }
  });

  it("paginates the high usage list with next and previous flags", async () => {
    const all = await get<HighMemoryUsageSessionsResponse>(
      highUsagePath(bundle),
    );
    const total = all.results!.length;
    const first = await get<HighMemoryUsageSessionsResponse>(
      highUsagePath(bundle, { limit: "1", offset: "0" }),
    );
    expect(first.results).toHaveLength(1);
    expect(first.meta).toEqual({ next: total > 1, previous: false });
    const last = await get<HighMemoryUsageSessionsResponse>(
      highUsagePath(bundle, { limit: "1", offset: String(total - 1) }),
    );
    expect(last.results).toHaveLength(1);
    expect(last.meta).toEqual({ next: false, previous: true });
    expect(last.results![0].session_id).toBe(
      all.results![total - 1].session_id,
    );
  });

  it("returns empty data, not an error, when filter_expr matches nothing or the range predates the app", async () => {
    const filter = { filter_expr: "version_name:in:9.9.9" };
    const base = `/api/apps/${bundle.app.id}/memory`;
    const emptyPage = { meta: { next: false, previous: false }, results: [] };
    expect(await get(plotPath(bundle, filter))).toEqual([]);
    expect(await get(breakdownPath(bundle, filter))).toEqual([]);
    expect(await get(highUsagePath(bundle, filter))).toEqual(emptyPage);
    expect(await get(`${base}/plots/usage?${EMPTY_RANGE}`)).toEqual([]);
    expect(await get(`${base}/plots/breakdown?${EMPTY_RANGE}`)).toEqual([]);
    expect(
      await get(`${base}/sessions/high-usage?${EMPTY_RANGE}&limit=5&offset=0`),
    ).toEqual(emptyPage);
  });

  it("narrows every route with a version filter", async () => {
    const version = bundle.scenario.app.versions[0].name;
    const filter = { filter_expr: `version_name:in:${version}` };
    const points = await get<MemoryUsagePlotPoint[]>(plotPath(bundle, filter));
    expect(points.length).toBeGreaterThan(0);
    const rows = await get<MemoryUsageBreakdownRow[]>(
      breakdownPath(bundle, filter),
    );
    const allRows = await get<MemoryUsageBreakdownRow[]>(breakdownPath(bundle));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.reduce((sum, r) => sum + r.session_count, 0)).toBeLessThan(
      allRows.reduce((sum, r) => sum + r.session_count, 0),
    );
    const page = await get<HighMemoryUsageSessionsResponse>(
      highUsagePath(bundle, filter),
    );
    for (const row of page.results ?? []) {
      expect(row.attribute.app_version).toBe(version);
    }
  });
});

describe("app_importance", () => {
  it("returns smaller but non-empty user_service and background data for the android app", async () => {
    const foreground = await get<MemoryUsagePlotPoint[]>(plotPath(android));
    const allRows = await get<MemoryUsageBreakdownRow[]>(
      breakdownPath(android),
    );
    const foregroundPage = await get<HighMemoryUsageSessionsResponse>(
      highUsagePath(android),
    );
    const mean = (rows: MemoryUsagePlotPoint[]) =>
      rows.reduce((sum, p) => sum + p.p50!, 0) / rows.length;
    for (const importance of ["user_service", "background"]) {
      const extra = { app_importance: importance };
      const points = await get<MemoryUsagePlotPoint[]>(
        plotPath(android, extra),
      );
      expect(points.length).toBe(foreground.length);
      expect(mean(points)).toBeGreaterThan(0);
      expect(mean(points)).toBeLessThan(mean(foreground));

      const rows = await get<MemoryUsageBreakdownRow[]>(
        breakdownPath(android, extra),
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.reduce((sum, r) => sum + r.session_count, 0)).toBeLessThan(
        allRows.reduce((sum, r) => sum + r.session_count, 0),
      );

      const page = await get<HighMemoryUsageSessionsResponse>(
        highUsagePath(android, extra),
      );
      expect(page.results!.length).toBeGreaterThan(0);
      for (const row of page.results!) {
        expectSessionRow(android, row);
        expect(row.percent_of_target).toBeGreaterThanOrEqual(75);
        const inForeground = foregroundPage.results!.find(
          (r) => r.session_id === row.session_id,
        );
        expect(inForeground).toBeDefined();
        expect(row.target_memory_kb).toBeLessThan(
          inForeground!.target_memory_kb!,
        );
        expect(row.peak_memory_kb).toBeLessThan(inForeground!.peak_memory_kb);
      }
    }
  });

  it("is ignored for the ios app", async () => {
    const extra = { app_importance: "background" };
    expect(await get(plotPath(ios, extra))).toEqual(await get(plotPath(ios)));
    expect(await get(breakdownPath(ios, extra))).toEqual(
      await get(breakdownPath(ios)),
    );
    expect(await get(highUsagePath(ios, extra))).toEqual(
      await get(highUsagePath(ios)),
    );
  });
});

describe("session memory samples", () => {
  it("gives every session a device total memory the tiers can place, and samples that add up", () => {
    for (const bundle of world.appById.values()) {
      for (const session of bundle.sessions) {
        const total = session.detail.attribute.device_total_memory;
        expect(total).toBeGreaterThan(3 * 1024 * MB);
        expect(total).toBeLessThan(17 * 1024 * MB);
        for (const row of session.detail.memory_usage_absolute ?? []) {
          expect(row.max_memory).toBe(total);
          expect(Number(row.available_memory)).toBeGreaterThan(0);
          expect(Number(row.used_memory)).toBeLessThan(total / 2);
        }
        for (const row of session.detail.memory_usage ?? []) {
          expect(row.dynamic_memory).toBe(
            Number(row.anon_rss) + Number(row.swap),
          );
          expect(Number(row.rss)).toBeGreaterThanOrEqual(Number(row.anon_rss));
        }
      }
    }
  });
});
