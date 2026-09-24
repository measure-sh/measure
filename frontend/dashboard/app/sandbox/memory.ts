import { DateTime } from "luxon";
import type {
  HighMemoryUsageSession,
  MemoryUsageBreakdownRow,
  MemoryUsagePlotPoint,
} from "../api/api_calls";
import { catalog, percentile } from "./catalog";
import type { AppBundle, SessionDetail, SessionListEntry } from "./catalog";
import {
  bucketsForRange,
  formatBucket,
  isWithinRange,
  jsonResponse,
  paginate,
  parseRange,
  SandboxRoute,
  scaledCount,
  stableInt,
  unitInterval,
} from "./query";
import { smoothScales, windowCoverage } from "./aggregate";
import { shareAt } from "./adoption";
import { matchesFilterExpr, sessionAttributeBag } from "./filter";
import {
  androidMemoryTargetKb,
  DEVICE_MEMORY_TIERS,
  deviceMemoryTier,
  HIGH_MEMORY_UTILIZATION_THRESHOLD,
  MEMORY_APP_STATES,
} from "./device_memory";
import type { MemoryAppState } from "./device_memory";

const REFERENCE_WINDOW_DAYS = 30;

type SessionMemory = {
  list: SessionListEntry;
  detail: SessionDetail;
  samples: number[];
  peakKb: number;
  tier: string;
  targetKb: number;
  percentOfTarget: number;
  utilization: number;
  availableAtPeakKb: number;
  high: boolean;
};

type AppStateView = {
  appState: MemoryAppState;
  scale: number;
  share: number;
};

// A filter that leaves more than one app state possible, such as one joined
// with OR, narrows to none of them.
function requestedAppState(url: URL): MemoryAppState | null {
  const filterExpr = url.searchParams.get("filter_expr");
  const matching = MEMORY_APP_STATES.filter((appState) =>
    matchesFilterExpr({ app_state: appState }, filterExpr),
  );
  return matching.length === 1 ? matching[0] : null;
}

// Without a filter every app state counts. iOS readings carry no app
// importance, so the filter does not narrow them.
function appStateView(bundle: AppBundle, url: URL): AppStateView {
  const requested =
    bundle.scenario.app.os === "android" ? requestedAppState(url) : null;
  if (requested === "foreground") {
    return { appState: "foreground", scale: 1, share: 0.8 };
  }
  if (requested === "user_service") {
    return { appState: "user_service", scale: 0.7, share: 0.3 };
  }
  if (requested === "background") {
    return { appState: "background", scale: 0.6, share: 0.45 };
  }
  return { appState: "foreground", scale: 1, share: 1 };
}

function sessionMemory(
  bundle: AppBundle,
  session: { list: SessionListEntry; detail: SessionDetail },
  view: AppStateView,
): SessionMemory {
  const { list, detail } = session;
  if (bundle.scenario.app.os === "android") {
    const samples = (detail.memory_usage ?? []).map((row) =>
      Math.round(Number(row.dynamic_memory) * view.scale),
    );
    const peakKb = samples.reduce((max, value) => Math.max(max, value), 0);
    const totalKb = detail.attribute.device_total_memory;
    const targetKb = androidMemoryTargetKb(totalKb, view.appState);
    const percentOfTarget = targetKb > 0 ? (peakKb * 100) / targetKb : 0;
    return {
      list,
      detail,
      samples,
      peakKb,
      tier: deviceMemoryTier(totalKb),
      targetKb,
      percentOfTarget,
      utilization: 0,
      availableAtPeakKb: 0,
      high:
        targetKb > 0 &&
        percentOfTarget >= HIGH_MEMORY_UTILIZATION_THRESHOLD * 100,
    };
  }
  const rows = detail.memory_usage_absolute ?? [];
  let peakKb = 0;
  let utilization = 0;
  let availableAtPeakKb = 0;
  for (const row of rows) {
    const used = Number(row.used_memory);
    const available = Number(row.available_memory);
    peakKb = Math.max(peakKb, used);
    if (available > 0 && used / (used + available) > utilization) {
      utilization = used / (used + available);
      availableAtPeakKb = available;
    }
  }
  return {
    list,
    detail,
    samples: rows.map((row) => Number(row.used_memory)),
    peakKb,
    tier: deviceMemoryTier(Number(rows[0]?.max_memory ?? 0)),
    targetKb: 0,
    percentOfTarget: 0,
    utilization,
    availableAtPeakKb,
    high: utilization >= HIGH_MEMORY_UTILIZATION_THRESHOLD,
  };
}

function visibleSessions(
  bundle: AppBundle,
  url: URL,
  view: AppStateView,
): SessionMemory[] {
  const filterExpr = url.searchParams.get("filter_expr");
  return bundle.sessions
    .map((session) => sessionMemory(bundle, session, view))
    .filter((memory) =>
      matchesFilterExpr(sessionAttributeBag(memory.detail), filterExpr),
    );
}

function inView(memory: SessionMemory, view: AppStateView): boolean {
  return (
    view.share === 1 ||
    memory.high ||
    unitInterval(`${memory.list.session_id}:app_state:${view.appState}`) <
      view.share
  );
}

// A pool of ten sessions would put a leaking session's samples in the p90, so
// the percentiles come from the sessions that stay within the threshold.
function typicalSamples(
  sessions: SessionMemory[],
  fallback: SessionMemory[],
): number[] {
  const typical = sessions.filter((memory) => !memory.high);
  const wider = fallback.filter((memory) => !memory.high);
  const pool =
    typical.length > 0 ? typical : wider.length > 0 ? wider : sessions;
  return pool.flatMap((memory) => memory.samples);
}

function percentilesOf(
  samples: number[],
  factor: number,
): { p50: number; p90: number; p95: number; p99: number } {
  const sorted = samples
    .map((value) => Math.round(value * factor))
    .sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

function meanSamplesPerSession(sessions: SessionMemory[]): number {
  if (sessions.length === 0) {
    return 0;
  }
  return (
    sessions.reduce((sum, memory) => sum + memory.samples.length, 0) /
    sessions.length
  );
}

function usagePlot(bundle: AppBundle, url: URL): MemoryUsagePlotPoint[] {
  const range = parseRange(url);
  const view = appStateView(bundle, url);
  const sessions = visibleSessions(bundle, url, view);
  const counted = sessions.filter((memory) => inView(memory, view));
  if (counted.length === 0) {
    return [];
  }
  const app = bundle.scenario.app;
  const dataStart = bundle.dataStart.startOf("day");
  const buckets = bucketsForRange(range).filter(
    (bucket) => bucket >= dataStart,
  );
  const narrowing = counted.length / bundle.sessions.length;
  // Every version draws on the same sample pool, since one or two sessions per
  // version would swamp the small step between versions.
  const samples = typicalSamples(sessions, sessions);
  const series = app.versions.map((version, i) => {
    const seed = `memory:${app.id}:${version.name}:${view.appState}`;
    return {
      version: `${version.name} (${version.code})`,
      samples,
      factor: 1 + i * 0.045,
      scales: smoothScales(seed, buckets.length, 0.08),
      index: i,
      dailySamples:
        app.dailySessions *
        meanSamplesPerSession(sessions) *
        narrowing *
        view.share,
      countSeed: stableInt(`${seed}:count`, 0, 100_000),
    };
  });
  const unit =
    range.group === "minutes"
      ? "minute"
      : range.group === "hours"
        ? "hour"
        : range.group === "months"
          ? "month"
          : "day";
  // A version plots only once enough sessions run it, from its release on.
  const points: MemoryUsagePlotPoint[] = [];
  buckets.forEach((bucket, i) => {
    const middle = DateTime.fromMillis(
      (bucket.toMillis() + bucket.plus({ [unit]: 1 }).toMillis()) / 2,
    );
    for (const entry of series) {
      const share = shareAt(bundle.releases, entry.index, middle);
      if (share < 0.01) {
        continue;
      }
      points.push({
        version: entry.version,
        datetime: formatBucket(bucket, range.group),
        ...percentilesOf(entry.samples, entry.factor * entry.scales[i]),
        sample_count: Math.max(
          1,
          scaledCount(
            entry.dailySamples * share,
            range.group,
            entry.countSeed + i,
          ),
        ),
      });
    }
  });
  return points;
}

function usageBreakdown(
  bundle: AppBundle,
  url: URL,
): MemoryUsageBreakdownRow[] {
  const range = parseRange(url);
  const view = appStateView(bundle, url);
  const sessions = visibleSessions(bundle, url, view);
  const counted = sessions.filter((memory) => inView(memory, view));
  const coverage = windowCoverage(range, bundle.dataStart);
  if (counted.length === 0 || coverage <= 0) {
    return [];
  }
  const app = bundle.scenario.app;
  const rows: MemoryUsageBreakdownRow[] = [];
  for (const tier of DEVICE_MEMORY_TIERS) {
    const members = counted.filter((memory) => memory.tier === tier);
    if (members.length === 0) {
      continue;
    }
    const { p50, p90, p95 } = percentilesOf(
      typicalSamples(
        sessions.filter((memory) => memory.tier === tier),
        sessions,
      ),
      1,
    );
    const sessionCount = Math.max(
      1,
      Math.round(
        app.dailySessions *
          REFERENCE_WINDOW_DAYS *
          coverage *
          (members.length / bundle.sessions.length),
      ),
    );
    rows.push({
      device_total_memory_tier: tier,
      p50,
      p90,
      p95,
      session_count: sessionCount,
      sample_count: Math.max(
        sessionCount,
        Math.round(sessionCount * meanSamplesPerSession(members)),
      ),
    });
  }
  return rows;
}

function highUsageSessions(
  bundle: AppBundle,
  url: URL,
): { results: HighMemoryUsageSession[]; hasNext: boolean; hasPrev: boolean } {
  const range = parseRange(url);
  const view = appStateView(bundle, url);
  const isAndroid = bundle.scenario.app.os === "android";
  const matching = visibleSessions(bundle, url, view)
    .filter(
      (memory) =>
        memory.high &&
        inView(memory, view) &&
        isWithinRange(memory.list.last_event_time, range),
    )
    .sort(
      (a, b) =>
        (isAndroid
          ? b.percentOfTarget - a.percentOfTarget
          : b.utilization - a.utilization) ||
        b.list.last_event_time.localeCompare(a.list.last_event_time) ||
        b.list.session_id.localeCompare(a.list.session_id),
    );
  const { items, hasNext, hasPrev } = paginate(matching, url);
  const results = items.map((memory) => {
    const attribute = memory.detail.attribute;
    const session: HighMemoryUsageSession = {
      session_id: memory.list.session_id,
      app_id: memory.list.app_id,
      first_event_time: memory.list.first_event_time,
      last_event_time: memory.list.last_event_time,
      peak_memory_kb: memory.peakKb,
      attribute: {
        app_version: attribute.app_version,
        app_build: attribute.app_build,
        device_name: attribute.device_name,
        device_model: attribute.device_model,
        device_manufacturer: attribute.device_manufacturer,
        device_total_memory: attribute.device_total_memory,
        os_name: attribute.os_name,
        os_version: attribute.os_version,
      },
    };
    if (isAndroid) {
      session.target_memory_kb = memory.targetKb;
      session.percent_of_target = memory.percentOfTarget;
    } else {
      session.peak_memory_limit_utilization = memory.utilization;
      session.available_memory_at_peak_utilization_kb =
        memory.availableAtPeakKb;
    }
    return session;
  });
  return { results, hasNext, hasPrev };
}

export const memoryRoutes: SandboxRoute[] = [
  {
    method: "GET",
    path: "/api/apps/:appId/memory/plots/usage",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      return jsonResponse(bundle ? usagePlot(bundle, url) : []);
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/memory/plots/breakdown",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      return jsonResponse(bundle ? usageBreakdown(bundle, url) : []);
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/memory/sessions/highUsage",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      if (!bundle) {
        return jsonResponse({
          meta: { next: false, previous: false },
          results: [],
        });
      }
      const { results, hasNext, hasPrev } = highUsageSessions(bundle, url);
      return jsonResponse({
        meta: { next: hasNext, previous: hasPrev },
        results,
      });
    },
  },
];
