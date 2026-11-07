import { describe, expect, it } from "@jest/globals";
import { DateTime } from "luxon";
import { handleSandboxRequest } from "@/app/sandbox/handlers";
import { catalog } from "@/app/sandbox/catalog";
import type { AppBundle } from "@/app/sandbox/catalog";
import { formatFilterExpr } from "@/app/components/filter_bar/parse";
import type {
  DeviceDurationRow,
  DeviceErrorsRow,
  DeviceMemoryRow,
  DeviceRowBase,
  DeviceSessionsPlotPoint,
  DevicesPage,
  DeviceSessionsRow,
} from "@/app/api/api_calls";

const world = catalog();

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
    ...extra,
  }).toString();
}

const EMPTY_RANGE =
  "from=1990-01-01T00:00:00.000Z&to=1990-01-02T00:00:00.000Z&timezone=UTC";

async function getJson<T>(path: string): Promise<T> {
  const res = await handleSandboxRequest(path);
  expect(res.status).toBe(200);
  return (await res.json()) as T;
}

async function get<Row>(path: string): Promise<Row[]> {
  const page = await getJson<DevicesPage<Row>>(path);
  return page.results;
}

function devicesPath(
  bundle: AppBundle,
  list: string,
  extra: Record<string, string> = {},
): string {
  return `/api/apps/${bundle.app.id}/devices/${list}?${weekParams(extra)}`;
}

function deviceFilter(row: DeviceRowBase): string {
  return formatFilterExpr({
    logical_operator: "and",
    children: [
      {
        condition: {
          key_name: "device_manufacturer",
          operator: "in",
          values: [{ text: row.device_manufacturer }],
        },
      },
      {
        condition: {
          key_name: "device_model",
          operator: "in",
          values: [{ text: row.device_model }],
        },
      },
    ],
  });
}

function expectRanked<Row>(rows: Row[], rank: (row: Row) => number) {
  expect(rows.length).toBeGreaterThan(0);
  for (let i = 1; i < rows.length; i++) {
    expect(rank(rows[i - 1])).toBeGreaterThanOrEqual(rank(rows[i]));
  }
}

function expectOrderedPercentiles(row: {
  p50: number | null;
  p90: number | null;
  p95: number | null;
}) {
  expect(row.p50).toBeGreaterThan(0);
  expect(row.p90).toBeGreaterThanOrEqual(row.p50!);
  expect(row.p95).toBeGreaterThanOrEqual(row.p90!);
}

describe("sandbox devices", () => {
  it.each([android, ios])("ranks devices by sessions", async (bundle) => {
    const rows = await get<DeviceSessionsRow>(devicesPath(bundle, "sessions"));
    expectRanked(rows, (row) => row.session_count);
    const percent = rows.reduce((sum, row) => sum + row.percent_of_sessions, 0);
    expect(percent).toBeLessThanOrEqual(100.0001);
    for (const row of rows) {
      expect(row.device_model).not.toBe("");
    }
  });

  it("narrows sessions to the filtered device", async () => {
    const [first] = await get<DeviceSessionsRow>(
      devicesPath(android, "sessions"),
    );
    const rows = await get<DeviceSessionsRow>(
      devicesPath(android, "sessions", { filter_expr: deviceFilter(first) }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].device_model).toBe(first.device_model);
    expect(rows[0].percent_of_sessions).toBe(100);
  });

  it.each([android, ios])("ranks devices by errors", async (bundle) => {
    const rows = await get<DeviceErrorsRow>(devicesPath(bundle, "errors"));
    expectRanked(rows, (row) => row.error_count);
    for (const row of rows) {
      expect(
        row.crash_count +
          row.anr_count +
          row.app_hang_count +
          row.non_fatal_count,
      ).toBe(row.error_count);
    }
  });

  it("ranks launches by the requested percentile", async () => {
    const p95 = await get<DeviceDurationRow>(devicesPath(android, "launches"));
    expectRanked(p95, (row) => row.p95 ?? 0);
    p95.forEach(expectOrderedPercentiles);
    const p50 = await get<DeviceDurationRow>(
      devicesPath(android, "launches", { percentile: "p50" }),
    );
    expectRanked(p50, (row) => row.p50 ?? 0);
    const invalid: Record<string, string>[] = [
      { launch_type: "lukewarm" },
      { percentile: "p99" },
    ];
    for (const extra of invalid) {
      const res = await handleSandboxRequest(
        devicesPath(android, "launches", extra),
      );
      expect(res.status).toBe(400);
    }
  });

  it("reads the requested span", async () => {
    const spanName = android.rootSpanNames[0];
    const rows = await get<DeviceDurationRow>(
      devicesPath(android, "spans", { span_name: spanName }),
    );
    expectRanked(rows, (row) => row.p95 ?? 0);
    rows.forEach(expectOrderedPercentiles);
    const none = await get<DeviceDurationRow>(
      devicesPath(android, "spans", { span_name: "no such span" }),
    );
    expect(none).toEqual([]);
  });

  it.each([android, ios])("ranks devices by memory", async (bundle) => {
    const rows = await get<DeviceMemoryRow>(devicesPath(bundle, "memory"));
    expectRanked(rows, (row) => row.p95 ?? 0);
    rows.forEach(expectOrderedPercentiles);
  });

  it.each(["sessions", "errors", "launches", "memory"])(
    "returns no %s rows for a range before the data",
    async (list) => {
      const rows = await get<unknown>(
        `/api/apps/${android.app.id}/devices/${list}?${EMPTY_RANGE}`,
      );
      expect(rows).toEqual([]);
    },
  );

  it("narrows the traces page to a device model", async () => {
    const res = await handleSandboxRequest(
      `/api/apps/${android.app.id}/spans/plots/metrics?${weekParams({
        span_name: android.rootSpanNames[0],
        plot_time_group: "days",
        filter_expr: `device_model:in:"no such model"`,
      })}`,
    );
    expect(await res.json()).toEqual([]);
  });

  it("ranks from the lowest value with order asc", async () => {
    const desc = await get<DeviceSessionsRow>(devicesPath(android, "sessions"));
    const asc = await get<DeviceSessionsRow>(
      devicesPath(android, "sessions", { order: "asc" }),
    );
    expect(asc).toHaveLength(desc.length);
    for (let i = 1; i < asc.length; i++) {
      expect(asc[i].session_count).toBeGreaterThanOrEqual(
        asc[i - 1].session_count,
      );
    }
    const res = await handleSandboxRequest(
      devicesPath(android, "sessions", { order: "sideways" }),
    );
    expect(res.status).toBe(400);
  });

  it("pages with limit and offset", async () => {
    const all = await get<DeviceSessionsRow>(devicesPath(android, "sessions"));
    expect(all.length).toBeGreaterThan(2);
    const first = await getJson<DevicesPage<DeviceSessionsRow>>(
      devicesPath(android, "sessions", { limit: "2", offset: "0" }),
    );
    expect(first.results).toEqual(all.slice(0, 2));
    expect(first.meta).toEqual({ next: true, previous: false });
    const second = await getJson<DevicesPage<DeviceSessionsRow>>(
      devicesPath(android, "sessions", { limit: "2", offset: "2" }),
    );
    expect(second.results).toEqual(all.slice(2, 4));
    expect(second.meta.previous).toBe(true);
    // The share is calculated from all matching sessions, not just the current
    // page.
    expect(second.results[0].percent_of_sessions).toBe(
      all[2].percent_of_sessions,
    );
  });

  it("plots sessions for the five most used devices", async () => {
    const top = await get<DeviceSessionsRow>(devicesPath(android, "sessions"));
    const points = await getJson<DeviceSessionsPlotPoint[]>(
      `/api/apps/${android.app.id}/devices/plots/sessions?${weekParams({
        plot_time_group: "days",
      })}`,
    );
    const models = new Set(points.map((point) => point.device_model));
    expect(models).toEqual(
      new Set(top.slice(0, 5).map((row) => row.device_model)),
    );
    const buckets = new Set(points.map((point) => point.datetime));
    expect(points).toHaveLength(buckets.size * models.size);
    const keys = points.map(
      (point) =>
        `${point.datetime}|${point.device_manufacturer}|${point.device_model}`,
    );
    expect(keys).toEqual([...keys].sort());
    for (const point of points) {
      expect(point.session_count).toBeGreaterThanOrEqual(0);
    }
    const empty = await getJson<DeviceSessionsPlotPoint[]>(
      `/api/apps/${android.app.id}/devices/plots/sessions?${EMPTY_RANGE}&plot_time_group=days`,
    );
    expect(empty).toEqual([]);
  });

  it.each([
    { os: "android", days: 7, group: "days" },
    { os: "ios", days: 30, group: "days" },
    { os: "android", days: 1, group: "hours" },
  ])(
    "adds each $os device's $group points up to its sessions count over $days days",
    async ({ os, days, group }) => {
      const bundle = os === "android" ? android : ios;
      const to = DateTime.now();
      const params = new URLSearchParams({
        from: to.minus({ days }).toISO()!,
        to: to.toISO()!,
        timezone: "UTC",
        plot_time_group: group,
      });
      const rows = await get<DeviceSessionsRow>(
        `/api/apps/${bundle.app.id}/devices/sessions?${params}`,
      );
      const points = await getJson<DeviceSessionsPlotPoint[]>(
        `/api/apps/${bundle.app.id}/devices/plots/sessions?${params}`,
      );
      const sums = new Map<string, number>();
      for (const point of points) {
        sums.set(
          point.device_model,
          (sums.get(point.device_model) ?? 0) + point.session_count,
        );
      }
      expect(sums.size).toBeGreaterThan(0);
      for (const [model, sum] of sums) {
        expect(
          rows.find((row) => row.device_model === model)?.session_count,
        ).toBe(sum);
      }
    },
  );
});
