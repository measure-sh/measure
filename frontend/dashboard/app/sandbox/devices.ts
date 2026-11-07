import type {
  DeviceDurationRow,
  DeviceErrorsRow,
  DeviceMemoryRow,
  DeviceRowBase,
  DeviceSessionsPlotPoint,
  DevicesPercentile,
  DeviceSessionsRow,
} from "../api/api_calls";
import { smoothScales, windowCoverage } from "./aggregate";
import { catalog, percentile } from "./catalog";
import type { AppBundle, SessionAttribute } from "./catalog";
import { errorTypeLabel, groupCount, groupSessionsAndUsers } from "./errors";
import { deviceAttributeBag, matchesFilterExpr } from "./filter";
import {
  appStateView,
  inView,
  meanSamplesPerSession,
  percentilesOf,
  REFERENCE_WINDOW_DAYS,
  sessionMemory,
  typicalSamples,
} from "./memory";
import type { SessionMemory } from "./memory";
import {
  bucketsForRange,
  formatBucket,
  isWithinRange,
  jsonResponse,
  pageResponse,
  parseRange,
  SandboxRoute,
} from "./query";
import type { SandboxRouteContext } from "./query";

const PLOTTED_DEVICES = 5;

const LAUNCH_TYPES = ["cold_launch", "warm_launch", "hot_launch"];

const PERCENTILES: DevicesPercentile[] = ["p50", "p90", "p95"];

type Device = DeviceRowBase;

function deviceOf(attribute: {
  device_manufacturer: string;
  device_model: string;
  device_name: string;
}): Device {
  return {
    device_manufacturer: attribute.device_manufacturer,
    device_model: attribute.device_model,
    device_name: attribute.device_name,
  };
}

// Span rows have no device name, so the name is read from a session on the same
// device.
function deviceNameOf(
  bundle: AppBundle,
  row: { device_manufacturer: string; device_model: string },
): string {
  return (
    bundle.sessions.find(
      (session) =>
        session.detail.attribute.device_manufacturer ===
          row.device_manufacturer &&
        session.detail.attribute.device_model === row.device_model,
    )?.detail.attribute.device_name ?? ""
  );
}

function deviceKey(device: Device): string {
  return `${device.device_manufacturer}\u0000${device.device_model}`;
}

function groupByDevice<T>(
  items: T[],
  deviceOfItem: (item: T) => Device,
): { device: Device; items: T[] }[] {
  const groups = new Map<string, { device: Device; items: T[] }>();
  for (const item of items) {
    const device = deviceOfItem(item);
    if (device.device_model === "") {
      continue;
    }
    const key = deviceKey(device);
    const group = groups.get(key) ?? { device, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return Array.from(groups.values());
}

type Ranked<Row extends Device> = {
  rows: Row[];
  rank: (row: Row) => number;
};

function noRows<Row extends Device>(): Ranked<Row> {
  return { rows: [], rank: () => 0 };
}

function ordered<Row extends Device>(
  { rows, rank }: Ranked<Row>,
  ascending: boolean,
): Row[] {
  return [...rows].sort(
    (a, b) =>
      (ascending ? rank(a) - rank(b) : rank(b) - rank(a)) ||
      a.device_manufacturer.localeCompare(b.device_manufacturer) ||
      a.device_model.localeCompare(b.device_model),
  );
}

function matchesDeviceFilter(
  attribute: SessionAttribute,
  filterExpr: string | null,
): boolean {
  return matchesFilterExpr(deviceAttributeBag(attribute), filterExpr);
}

// The catalog generates a few hundred sessions. Each generated session
// represents this many sessions in the requested range.
function sessionsPerGenerated(bundle: AppBundle, url: URL): number {
  const coverage = windowCoverage(parseRange(url), bundle.dataStart);
  if (coverage <= 0 || bundle.sessions.length === 0) {
    return 0;
  }
  return (
    (bundle.scenario.app.dailySessions * REFERENCE_WINDOW_DAYS * coverage) /
    bundle.sessions.length
  );
}

function scaled(count: number, scale: number): number {
  return Math.max(1, Math.round(count * scale));
}

function durationPercentiles(durations: number[]) {
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
  };
}

function matchingSessions(bundle: AppBundle, url: URL) {
  const filterExpr = url.searchParams.get("filter_expr");
  return bundle.sessions.filter((session) =>
    matchesDeviceFilter(session.detail.attribute, filterExpr),
  );
}

function sessionsByDevice(
  bundle: AppBundle,
  url: URL,
): Ranked<DeviceSessionsRow> {
  const scale = sessionsPerGenerated(bundle, url);
  const sessions = matchingSessions(bundle, url);
  if (scale === 0 || sessions.length === 0) {
    return noRows();
  }
  const groups = groupByDevice(sessions, (s) => deviceOf(s.detail.attribute));
  const counted = groups.reduce((sum, group) => sum + group.items.length, 0);
  return {
    rows: groups.map(({ device, items }) => ({
      ...device,
      session_count: scaled(items.length, scale),
      percent_of_sessions: (items.length * 100) / counted,
    })),
    rank: (row) => row.session_count,
  };
}

function errors(bundle: AppBundle, url: URL): Ranked<DeviceErrorsRow> {
  const range = parseRange(url);
  const filterExpr = url.searchParams.get("filter_expr");
  const rows = new Map<string, DeviceErrorsRow>();
  for (const group of bundle.errorGroups) {
    const inRange = group.instances.filter((instance) =>
      isWithinRange(instance.timestamp, range),
    );
    const matching = inRange.filter((instance) =>
      matchesDeviceFilter(instance.attribute, filterExpr),
    );
    if (matching.length === 0) {
      continue;
    }
    // A group keeps a few sample instances, so its event count is divided among
    // devices in proportion to those samples.
    const count = groupCount(bundle, group, range, filterExpr);
    const sessionsPerEvent =
      groupSessionsAndUsers(group, count).sessions / Math.max(1, count);
    const label = errorTypeLabel(group);
    for (const { device, items } of groupByDevice(matching, (i) =>
      deviceOf(i.attribute),
    )) {
      const events = Math.round((count * items.length) / inRange.length);
      if (events === 0) {
        continue;
      }
      const row = rows.get(deviceKey(device)) ?? {
        ...device,
        crash_count: 0,
        anr_count: 0,
        app_hang_count: 0,
        non_fatal_count: 0,
        error_count: 0,
        session_count: 0,
      };
      if (label === "Crash") {
        row.crash_count += events;
      } else if (label === "ANR") {
        row.anr_count += events;
      } else if (label === "App Hang") {
        row.app_hang_count += events;
      } else {
        row.non_fatal_count += events;
      }
      row.error_count += events;
      row.session_count += Math.max(1, Math.round(events * sessionsPerEvent));
      rows.set(deviceKey(device), row);
    }
  }
  return { rows: Array.from(rows.values()), rank: (row) => row.error_count };
}

function launches(bundle: AppBundle, url: URL): Ranked<DeviceDurationRow> {
  const launchType = url.searchParams.get("launch_type") ?? "cold_launch";
  const scale = sessionsPerGenerated(bundle, url);
  if (scale === 0) {
    return noRows();
  }
  const samples = matchingSessions(bundle, url).flatMap((session) =>
    Object.values(session.detail.threads)
      .flat()
      .filter(
        (event) =>
          event.event_type === launchType && Number(event.duration) > 0,
      )
      .map((event) => ({
        device: deviceOf(session.detail.attribute),
        duration: Number(event.duration),
      })),
  );
  return {
    rows: groupByDevice(samples, (sample) => sample.device).map(
      ({ device, items }) => ({
        ...device,
        ...durationPercentiles(items.map((item) => item.duration)),
        count: scaled(items.length, scale),
      }),
    ),
    rank: (row) => row[percentileOf(url)] ?? 0,
  };
}

function spans(bundle: AppBundle, url: URL): Ranked<DeviceDurationRow> {
  const spanName = url.searchParams.get("span_name") ?? "";
  const filterExpr = url.searchParams.get("filter_expr");
  const scale = sessionsPerGenerated(bundle, url);
  if (scale === 0) {
    return noRows();
  }
  const matching = bundle.spanRows
    .filter((row) => row.span_name === spanName)
    .map((row) => ({
      row,
      device: deviceOf({ ...row, device_name: deviceNameOf(bundle, row) }),
    }))
    .filter(({ row, device }) =>
      matchesFilterExpr(
        {
          version_name: row.app_version,
          version_code: row.app_build,
          os_name: row.os_name,
          os_version: row.os_version,
          device_name: device.device_name,
          device_manufacturer: device.device_manufacturer,
          device_model: device.device_model,
        },
        filterExpr,
      ),
    );
  return {
    rows: groupByDevice(matching, (item) => item.device).map(
      ({ device, items }) => ({
        ...device,
        ...durationPercentiles(items.map((item) => item.row.duration)),
        count: scaled(items.length, scale),
      }),
    ),
    rank: (row) => row[percentileOf(url)] ?? 0,
  };
}

function memory(bundle: AppBundle, url: URL): Ranked<DeviceMemoryRow> {
  const scale = sessionsPerGenerated(bundle, url);
  if (scale === 0) {
    return noRows();
  }
  const view = appStateView(bundle, url);
  const sessions: SessionMemory[] = matchingSessions(bundle, url).map(
    (session) => sessionMemory(bundle, session, view),
  );
  return {
    rows: groupByDevice(
      sessions.filter(
        (memory) => memory.samples.length > 0 && inView(memory, view),
      ),
      (memory) => deviceOf(memory.detail.attribute),
    ).map(({ device, items }) => {
      const sameDevice = sessions.filter(
        (memory) =>
          deviceKey(deviceOf(memory.detail.attribute)) === deviceKey(device),
      );
      const { p50, p90, p95 } = percentilesOf(
        typicalSamples(sameDevice, sessions),
        1,
      );
      const sessionCount = scaled(items.length, scale);
      return {
        ...device,
        p50,
        p90,
        p95,
        session_count: sessionCount,
        sample_count: Math.max(
          sessionCount,
          Math.round(sessionCount * meanSamplesPerSession(items)),
        ),
      };
    }),
    rank: (row) => row[percentileOf(url)] ?? 0,
  };
}

function percentileOf(url: URL): DevicesPercentile {
  return (url.searchParams.get("percentile") ?? "p95") as DevicesPercentile;
}

function route<Row extends Device>(
  list: string,
  rowsOf: (bundle: AppBundle, url: URL) => Ranked<Row>,
  validate: (url: URL) => string | null = () => null,
): SandboxRoute {
  return {
    method: "GET",
    path: `/api/apps/:appId/devices/${list}`,
    handle: ({ params, url }: SandboxRouteContext) => {
      const order = url.searchParams.get("order") ?? "desc";
      const problem =
        order !== "desc" && order !== "asc"
          ? "order must be one of desc, asc"
          : !PERCENTILES.includes(percentileOf(url))
            ? "percentile must be one of p50, p90, p95"
            : validate(url);
      if (problem !== null) {
        return jsonResponse({ error: problem }, 400);
      }
      const bundle = catalog().appById.get(params.appId);
      const rows = bundle ? ordered(rowsOf(bundle, url), order === "asc") : [];
      return pageResponse(rows, url);
    },
  };
}

function launchTypeProblem(url: URL): string | null {
  const launchType = url.searchParams.get("launch_type");
  return launchType !== null && !LAUNCH_TYPES.includes(launchType)
    ? `launch_type must be one of ${LAUNCH_TYPES.join(", ")}`
    : null;
}

// Each plotted device gets its share of daily app sessions, varied smoothly by
// bucket to avoid flat lines.
function sessionsPlot(bundle: AppBundle, url: URL): DeviceSessionsPlotPoint[] {
  const range = parseRange(url);
  const devices = ordered(sessionsByDevice(bundle, url), false)
    .slice(0, PLOTTED_DEVICES)
    .sort(
      (a, b) =>
        a.device_manufacturer.localeCompare(b.device_manufacturer) ||
        a.device_model.localeCompare(b.device_model),
    );
  if (devices.length === 0) {
    return [];
  }
  const dataStart = bundle.dataStart.startOf("day");
  const buckets = bucketsForRange(range).filter(
    (bucket) => bucket >= dataStart,
  );
  // Each device's session count is divided across buckets, so its line totals
  // match the session count in the sessions list.
  const series = devices.map((device) => {
    const seed = `devices:${bundle.app.id}:${deviceKey(device)}`;
    return {
      device,
      counts: splitCount(
        device.session_count,
        smoothScales(seed, buckets.length, 0.12),
      ),
    };
  });
  return buckets.flatMap((bucket, i) =>
    series.map((entry) => ({
      device_manufacturer: entry.device.device_manufacturer,
      device_model: entry.device.device_model,
      datetime: formatBucket(bucket, range.group),
      session_count: entry.counts[i],
    })),
  );
}

// Rounds each weighted share down, then assigns leftover units to the largest
// fractional remainders so the shares sum to the total.
function splitCount(total: number, weights: number[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  if (sum <= 0) {
    return weights.map(() => 0);
  }
  const exact = weights.map((weight) => (total * weight) / sum);
  const counts = exact.map(Math.floor);
  let leftover = total - counts.reduce((acc, count) => acc + count, 0);
  const byFraction = exact
    .map((value, i) => ({ i, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const { i } of byFraction) {
    if (leftover <= 0) {
      break;
    }
    counts[i]++;
    leftover--;
  }
  return counts;
}

export const devicesRoutes: SandboxRoute[] = [
  {
    method: "GET",
    path: "/api/apps/:appId/devices/plots/sessions",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      return jsonResponse(bundle ? sessionsPlot(bundle, url) : []);
    },
  },
  route("sessions", sessionsByDevice),
  route("errors", errors),
  route("launches", launches, launchTypeProblem),
  route("spans", spans),
  route("memory", memory),
];
