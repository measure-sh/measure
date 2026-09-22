import { handleSandboxRequest } from "@/app/sandbox/handlers";
import { catalog } from "@/app/sandbox/catalog";
import { beforeAll, describe, expect, it } from "@jest/globals";
import { DateTime } from "luxon";

const world = catalog();
const now = world.builtAt;
const apps = Array.from(world.appById.values());

const ranges = [
  { name: "6 hours", from: now.minus({ hours: 6 }), group: "minutes" },
  { name: "24 hours", from: now.minus({ hours: 24 }), group: "hours" },
  { name: "30 days", from: now.minus({ days: 30 }), group: "days" },
];

type Range = (typeof ranges)[number];

function query(range: Range, extra: Record<string, string> = {}): string {
  return new URLSearchParams({
    from: range.from.toISO()!,
    to: now.toISO()!,
    plot_time_group: range.group,
    timezone: "UTC",
    ...extra,
  }).toString();
}

async function get(path: string): Promise<any> {
  const res = await handleSandboxRequest(path);
  expect(res.status).toBe(200);
  return res.json();
}

type Point = { datetime: string };
type Series = { label: string; values: number[]; stamps: DateTime[] };

function seriesOf(
  label: string,
  points: Point[],
  read: (point: any) => number,
): Series {
  return {
    label,
    values: points.map(read),
    stamps: points.map((point) => DateTime.fromISO(point.datetime)),
  };
}

function instancesOf(label: string, plot: any[]): Series[] {
  return plot.map((entry: any) =>
    seriesOf(`${label} ${entry.id}`, entry.data, (point) => point.instances),
  );
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
}

// The first and last bucket only partly overlap the range, so their counts
// would stretch the span by an amount that depends on the wall clock seconds.
function whole(values: number[]): number[] {
  return values.length >= 5 ? values.slice(1, values.length - 1) : values;
}

function longestRun(values: number[]): number {
  let longest = 1;
  let run = 1;
  for (let i = 1; i < values.length; i++) {
    run = values[i] === values[i - 1] ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return longest;
}

function autocorrelation(raw: number[]): number {
  const values = whole(raw);
  const average = mean(values);
  let covariance = 0;
  let variance = 0;
  for (let i = 0; i < values.length; i++) {
    variance += (values[i] - average) ** 2;
    if (i > 0) {
      covariance += (values[i] - average) * (values[i - 1] - average);
    }
  }
  return variance === 0 ? 0 : covariance / variance;
}

function hourBoundaryStep(series: Series): number | null {
  const gaps: number[] = [];
  for (let i = 10; i + 10 <= series.values.length; i++) {
    if (series.stamps[i].minute !== 0) {
      continue;
    }
    const before = mean(series.values.slice(i - 10, i));
    const after = mean(series.values.slice(i, i + 10));
    if (before > 0 && after > 0) {
      gaps.push(Math.abs(Math.log(after / before)));
    }
  }
  return gaps.length === 0 ? null : mean(gaps);
}

// A version's series stays at zero until the version is released.
function sinceFirstCount(values: number[]): number[] {
  const first = values.findIndex((value) => value > 0);
  return first < 0 ? values : values.slice(first);
}

function expectDrawnCounts(series: Series): void {
  const values = whole(sinceFirstCount(series.values));
  const average = mean(values);
  if (average > 3) {
    expect([series.label, longestRun(values) <= 8]).toEqual([
      series.label,
      true,
    ]);
    const span = Math.max(...values) - Math.min(...values) + 1;
    const enough = Math.floor(Math.min(values.length / 3, span / 2));
    expect([series.label, new Set(values).size >= enough]).toEqual([
      series.label,
      true,
    ]);
  }
}

function expectDrift(series: Series): void {
  if (series.values.length < 20) {
    return;
  }
  const drift = autocorrelation(series.values);
  expect([series.label, drift > 0]).toEqual([series.label, true]);
  if (series.values.length >= 100) {
    expect([series.label, drift > 0.4]).toEqual([series.label, true]);
  }
}

describe.each(apps)("plots read as telemetry: $app.name", (bundle) => {
  const appId = bundle.app.id;
  const endpoint = Array.from(bundle.networkEndpoints.values())[0];
  const spanName = bundle.rootSpanNames[0];

  describe.each(ranges)("over the last $name", (range) => {
    const params = query(range);
    let counted: Series[];
    let latency: any;
    let spanMetrics: any;

    beforeAll(async () => {
      const groupList = await get(
        `/api/apps/${appId}/errorGroups?${query(range, { limit: "50", offset: "0" })}`,
      );
      latency = await get(
        `/api/apps/${appId}/networkRequests/plots/latency?${query(range, {
          domain: endpoint.domain,
          path: endpoint.path,
        })}`,
      );
      const statusCodes = await get(
        `/api/apps/${appId}/networkRequests/plots/statusCodes?${params}`,
      );
      spanMetrics = await get(
        `/api/apps/${appId}/spans/plots/metrics?${query(range, { span_name: spanName })}`,
      );
      counted = [
        ...instancesOf(
          "health",
          await get(`/api/apps/${appId}/health/plots/instances?${params}`),
        ),
        ...instancesOf(
          "sessions",
          await get(`/api/apps/${appId}/sessions/plots/instances?${params}`),
        ),
        ...instancesOf(
          "errors",
          await get(`/api/apps/${appId}/errorGroups/plots/instances?${params}`),
        ),
        ...instancesOf(
          "error group",
          await get(
            `/api/apps/${appId}/errorGroups/${groupList.results[0].id}/plots/instances?${params}`,
          ),
        ),
        ...instancesOf(
          "bug reports",
          await get(`/api/apps/${appId}/bugReports/plots/instances?${params}`),
        ),
        seriesOf("latency count", latency, (point) => point.count),
        seriesOf(
          "status codes total",
          statusCodes,
          (point) => point.total_count,
        ),
        seriesOf("status codes 2xx", statusCodes, (point) => point.count_2xx),
        seriesOf("status codes 4xx", statusCodes, (point) => point.count_4xx),
        seriesOf("status codes 5xx", statusCodes, (point) => point.count_5xx),
      ];
    });

    it("draws every count plot bucket by bucket rather than off a weight table", () => {
      expect(counted.length).toBeGreaterThan(0);
      for (const series of counted) {
        expect(series.values.length).toBeGreaterThan(0);
        expectDrawnCounts(series);
      }
    });

    it("lets latency and percentile readings drift instead of redrawing each bucket", () => {
      for (const series of [
        seriesOf("latency p50", latency, (point) => point.p50),
        seriesOf("latency p95", latency, (point) => point.p95),
        seriesOf("span p50", spanMetrics[0].data, (point: any) => point.p50),
        seriesOf("span p99", spanMetrics[0].data, (point: any) => point.p99),
      ]) {
        expectDrift(series);
      }
    });

    it("keeps a minute plot level across an hour boundary", () => {
      if (range.group !== "minutes") {
        return;
      }
      for (const series of [
        ...counted.filter((s) =>
          /^(health|sessions|latency count|status codes total)/.test(s.label),
        ),
        seriesOf("latency p50", latency, (point) => point.p50),
        seriesOf("span p95", spanMetrics[0].data, (point: any) => point.p95),
      ]) {
        if (mean(series.values) <= 60) {
          continue;
        }
        const step = hourBoundaryStep(series);
        if (step !== null) {
          expect([series.label, step < 0.15]).toEqual([series.label, true]);
        }
      }
    });
  });
});
