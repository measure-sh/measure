import type { ExceptionGroupCommonPath } from "@/app/query/hooks";
import { catalog } from "./catalog";
import type {
  AppBundle,
  ErrorGroup,
  ErrorInstance,
  GeneratedEvent,
} from "./catalog";
import type { DeviceSpec } from "./scenario";
import {
  isWithinRange,
  jsonResponse,
  paginate,
  parseRange,
  SandboxRange,
  SandboxRoute,
  stableInt,
  unitInterval,
} from "./query";
import { countryOf, deviceAttributeBag, matchesFilterExpr } from "./filter";
import { distributeTotal, scaledSeries, windowCoverage } from "./aggregate";
import {
  adoptionOf,
  groupCount as versionedGroupCount,
  groupVersionCounts,
  selectedNames,
} from "./adoption";

export function errorTypeLabel(group: ErrorGroup): string {
  if (group.error_type === "anr") {
    return "ANR";
  }
  if (group.severity === "unhandled") {
    return "Unhandled Error";
  }
  if (group.severity === "handled") {
    return "Handled Error";
  }
  return "Crash";
}

function instanceAttributes(
  group: ErrorGroup,
  instance: ErrorInstance,
): Record<string, unknown> {
  return {
    error_type: errorTypeLabel(group),
    ...deviceAttributeBag(instance.attribute),
  };
}

// The backend lists only the groups with an event inside the range, and the
// instances route filters by timestamp the same way, so a listed group always
// opens to at least one instance.
function groupMatches(
  group: ErrorGroup,
  range: SandboxRange,
  filterExpr: string | null,
): boolean {
  return group.instances.some(
    (instance) =>
      isWithinRange(instance.timestamp, range) &&
      matchesFilterExpr(instanceAttributes(group, instance), filterExpr),
  );
}

function groupCount(
  bundle: AppBundle,
  group: ErrorGroup,
  range: SandboxRange,
  filterExpr: string | null,
): number {
  return versionedGroupCount(
    bundle,
    group,
    range,
    selectedNames(bundle.scenario.app, filterExpr),
  );
}

// A group's count split over the selected versions it occurs on, so its plot
// series and its app_version distribution add up to its list row.
function versionCounts(
  bundle: AppBundle,
  group: ErrorGroup,
  range: SandboxRange,
  filterExpr: string | null,
) {
  return groupVersionCounts(
    bundle,
    group,
    range,
    selectedNames(bundle.scenario.app, filterExpr),
  );
}

function summaryOf(group: ErrorGroup, count: number) {
  const { instances: _instances, screen: _screen, ...summary } = group;
  return { ...summary, count };
}

const COMMON_PATH_SESSION_LIMIT = 50;
const COMMON_PATH_MIN_CONFIDENCE = 30;

// Mirrors formatExceptionMessage in the backend's issue_common_path.go.
function exceptionSummary(event: GeneratedEvent): string {
  const type = String(event.type ?? "");
  const message = String(event.message ?? "");
  if (type && message) {
    return `${type} - ${message}`;
  }
  return type || message || "Unknown error";
}

function viewLabel(event: GeneratedEvent): string {
  const id = String(event.target_id ?? "");
  const target = String(event.target ?? "");
  const named = id || target || "unknown view";
  return id && target ? `${named} (${target})` : named;
}

// Mirrors the backend's description of each event type in a common path.
function pathDescription(event: GeneratedEvent): string {
  const cls = String(event.class_name ?? "unknown");
  switch (event.event_type) {
    case "error": {
      const prefix =
        event.severity === "unhandled"
          ? "Unhandled error: "
          : event.severity === "handled"
            ? "Handled error: "
            : "Crash: ";
      return `${prefix}${exceptionSummary(event)}`;
    }
    case "anr":
      return `ANR: ${exceptionSummary(event)}`;
    case "app_exit":
      return `App exited: ${event.reason}`;
    case "gesture_click":
      return `User tapped on ${viewLabel(event)}`;
    case "gesture_long_click":
      return `User long-pressed on ${viewLabel(event)}`;
    case "gesture_scroll":
      return `User scrolled in ${viewLabel(event)}`;
    case "screen_view":
      return `Viewed screen: ${event.name}`;
    case "lifecycle_activity":
      return `Activity ${event.type}: ${cls}`;
    case "lifecycle_fragment":
      return `Fragment ${event.type}: ${cls}`;
    case "lifecycle_view_controller": {
      const verb: Record<string, string> = {
        viewDidLoad: "loaded",
        viewWillAppear: "will appear",
        viewDidAppear: "appeared",
        viewWillDisappear: "will disappear",
        viewDidDisappear: "disappeared",
      };
      return `View controller ${verb[String(event.type)] ?? event.type}: ${cls}`;
    }
    case "lifecycle_swift_ui":
      return `SwiftUI view ${event.type === "on_appear" ? "appeared" : "disappeared"}: ${cls}`;
    case "lifecycle_app":
      return `App moved to ${event.type}`;
    case "cold_launch":
    case "warm_launch":
    case "hot_launch":
      return `App ${event.event_type.replace("_launch", "")} launched (activity: ${event.launched_activity})`;
    case "network_change": {
      const side = (type: unknown, generation: unknown) =>
        `${type}${generation ? ` (${generation})` : ""}`;
      return `Network changed from ${side(event.previous_network_type, event.previous_network_generation)} to ${side(event.network_type, event.network_generation)}`;
    }
    case "http":
      return `HTTP ${event.method} to ${event.url}${Number(event.status_code) > 0 ? ` (status: ${event.status_code})` : ""}`;
    case "trim_memory":
      return `System requested memory trim (level: ${event.level})`;
    case "custom":
      return `Custom event: ${event.name}`;
    case "log":
      return `Log [${event.severity_text}]: ${String(event.body).slice(0, 80)}`;
    case "bug_report":
      return "User submitted bug report";
    default:
      return `Event: ${event.event_type}`;
  }
}

// Follows the backend: every analyzed session's events up to its error are
// lined up by their distance from the error, and each position keeps the
// event the most sessions share there. The generated instances stand in for
// the analyzed sessions, and a step's confidence also falls with its
// distance from the error, the way more sessions diverge further back.
function commonPathFor(
  bundle: AppBundle,
  group: ErrorGroup,
  count: number,
): ExceptionGroupCommonPath {
  const sessions = new Map<string, string>();
  for (const instance of group.instances) {
    const latest = sessions.get(instance.session_id);
    if (!latest || instance.timestamp > latest) {
      sessions.set(instance.session_id, instance.timestamp);
    }
  }
  const byPosition = new Map<
    number,
    Map<string, { thread: string; sessions: number }>
  >();
  for (const [sessionId, errorAt] of sessions) {
    const detail = bundle.sessions.find(
      (s) => s.list.session_id === sessionId,
    )?.detail;
    if (!detail) {
      continue;
    }
    const events = Object.values(detail.threads)
      .flat()
      .filter((event) => event.timestamp <= errorAt)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, COMMON_PATH_SESSION_LIMIT);
    events.forEach((event, i) => {
      const steps = byPosition.get(i + 1) ?? new Map();
      const description = pathDescription(event);
      const step = steps.get(description) ?? {
        thread: event.thread_name,
        sessions: 0,
      };
      step.sessions += 1;
      steps.set(description, step);
      byPosition.set(i + 1, steps);
    });
  }
  const seen = new Set<string>();
  const steps: ExceptionGroupCommonPath["steps"] = [];
  for (const position of [...byPosition.keys()].sort((a, b) => b - a)) {
    const [description, best] = [...byPosition.get(position)!.entries()].sort(
      (a, b) => b[1].sessions - a[1].sessions || a[0].localeCompare(b[0]),
    )[0];
    const agreement = best.sessions / sessions.size;
    const fade =
      position === 1
        ? 1
        : 1 -
          (position - 1) * 0.035 -
          stableInt(`${group.id}:path:${position}`, 0, 40) / 1000;
    const confidence = Math.round(agreement * fade * 1000) / 10;
    if (confidence < COMMON_PATH_MIN_CONFIDENCE || seen.has(description)) {
      continue;
    }
    seen.add(description);
    steps.push({
      description,
      thread_name: best.thread,
      confidence_pct: confidence,
    });
  }
  return {
    sessions_analyzed: Math.max(1, Math.min(COMMON_PATH_SESSION_LIMIT, count)),
    steps,
  };
}

function countsFor(
  labels: string[],
  weights: number[],
  total: number,
): Record<string, number> {
  const values = distributeTotal(total, weights);
  const carried = labels
    .map((label, i) => [label, values[i]] as const)
    .filter(([, value]) => value > 0);
  return Object.fromEntries(
    carried.length > 0 ? carried : labels.map((label) => [label, 0]),
  );
}

function skewedCounts(
  seed: string,
  pool: string[],
  own: string[],
  total: number,
): Record<string, number> {
  const fromInstances = new Set(own);
  const labels = Array.from(new Set([...own, ...pool]));
  const ranked = [...labels].sort(
    (a, b) =>
      unitInterval(`${seed}:${a}`) -
      (fromInstances.has(a) ? 0.6 : 0) -
      (unitInterval(`${seed}:${b}`) - (fromInstances.has(b) ? 0.6 : 0)),
  );
  const weightByLabel = new Map<string, number>();
  let share = 1;
  ranked.forEach((label, rank) => {
    weightByLabel.set(
      label,
      share * (0.85 + unitInterval(`${seed}:${label}:spread`) * 0.3),
    );
    share *= 0.42 + unitInterval(`${seed}:${rank}:decay`) * 0.3;
  });
  return countsFor(
    labels,
    labels.map((label) => weightByLabel.get(label) ?? 0),
    total,
  );
}

// Locales and countries split the way the app's users do, since a group
// shows no preference for either.
function byRoster(values: string[], total: number): Record<string, number> {
  const labels = Array.from(new Set(values));
  return countsFor(
    labels,
    labels.map((label) => values.filter((v) => v === label).length),
    total,
  );
}

function distributionFor(
  bundle: AppBundle,
  group: ErrorGroup,
  range: SandboxRange,
  filterExpr: string | null,
) {
  const versions = versionCounts(bundle, group, range, filterExpr);
  const total = versions.reduce((sum, v) => sum + v.count, 0);
  const app = bundle.scenario.app;
  const attrs = group.instances.map((i) => i.attribute);
  const pool = (read: (device: DeviceSpec) => string) =>
    bundle.scenario.devices.map(read);
  const spread = (
    dimension: string,
    poolValues: string[],
    ownValues: string[],
  ) => skewedCounts(`${group.id}:${dimension}`, poolValues, ownValues, total);
  return {
    app_version: countsFor(
      versions.map((v) => v.label),
      versions.map((v) => v.count),
      total,
    ),
    os_version: spread(
      "os_version",
      pool((d) => `${app.os} ${d.os_version}`),
      attrs.map((a) => `${a.os_name} ${a.os_version}`),
    ),
    country: byRoster(
      bundle.scenario.users.map((u) => countryOf(u.locale)),
      total,
    ),
    network_type: spread(
      "network_type",
      pool((d) => d.network_type),
      attrs.map((a) => a.network_type),
    ),
    locale: byRoster(
      bundle.scenario.users.map((u) => u.locale),
      total,
    ),
    device: spread(
      "device",
      pool((d) => `${d.device_manufacturer} - ${d.device_name}`),
      attrs.map((a) => `${a.device_manufacturer} - ${a.device_name}`),
    ),
  };
}

function findGroup(appId: string, id: string): ErrorGroup | undefined {
  return catalog()
    .appById.get(appId)
    ?.errorGroups.find((g) => g.id === id);
}

// A version's series follows its adoption over the range and sums to the
// count its list row shows.
function seriesFor(
  bundle: AppBundle,
  range: SandboxRange,
  count: number,
  seed: string,
  versionName: string,
) {
  const adoption = adoptionOf(bundle.releases, [versionName]);
  const coverage = windowCoverage(range, bundle.dataStart, adoption);
  return scaledSeries(
    range,
    coverage === 0 ? 0 : count / coverage,
    bundle.dataStart,
    seed,
    bundle.app.id,
    adoption,
  );
}

function byLabel(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export const errorsRoutes: SandboxRoute[] = [
  {
    method: "GET",
    path: "/api/apps/:appId/errorGroups",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      const range = parseRange(url);
      const filterExpr = url.searchParams.get("filter_expr");
      const counted = (bundle?.errorGroups ?? [])
        .filter((g) => groupMatches(g, range, filterExpr))
        .map((g) => summaryOf(g, groupCount(bundle!, g, range, filterExpr)))
        .sort(
          (a, b) =>
            b.count - a.count ||
            b.updated_at.localeCompare(a.updated_at) ||
            a.id.localeCompare(b.id),
        );
      const total = counted.reduce((sum, g) => sum + g.count, 0);
      const items = counted.map((g) => ({
        ...g,
        percentage_contribution:
          total === 0 ? 0 : Math.round((g.count * 10000) / total) / 100,
      }));
      const { items: page, hasNext, hasPrev } = paginate(items, url);
      return jsonResponse({
        meta: { next: hasNext, previous: hasPrev },
        results: page,
      });
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/errorGroups/plots/instances",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      if (!bundle) {
        return jsonResponse(null);
      }
      const range = parseRange(url);
      const filterExpr = url.searchParams.get("filter_expr");
      const byVersion = new Map<
        string,
        { datetime: string; instances: number }[]
      >();
      for (const group of bundle.errorGroups) {
        if (!groupMatches(group, range, filterExpr)) {
          continue;
        }
        for (const version of versionCounts(bundle, group, range, filterExpr)) {
          const label = `${version.name} (${version.code})`;
          const series = seriesFor(
            bundle,
            range,
            version.count,
            `errorgroup:${group.id}:${version.name}`,
            version.name,
          );
          const summed = byVersion.get(label);
          byVersion.set(
            label,
            summed
              ? summed.map((p, i) => ({
                  ...p,
                  instances: p.instances + series[i].instances,
                }))
              : series,
          );
        }
      }
      const seriesList = Array.from(byVersion.entries())
        .map(([id, data]) => ({ id, data }))
        .sort(byLabel);
      return jsonResponse(seriesList.length === 0 ? null : seriesList);
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/errorGroups/:id/errors",
    handle: ({ params, url }) => {
      const group = findGroup(params.appId, params.id);
      if (!group) {
        return jsonResponse({ error: "Error group not found" }, 404);
      }
      const range = parseRange(url);
      const filterExpr = url.searchParams.get("filter_expr");
      const items = group.instances.filter(
        (i) =>
          isWithinRange(i.timestamp, range) &&
          matchesFilterExpr(instanceAttributes(group, i), filterExpr),
      );
      const { items: page, hasNext, hasPrev } = paginate(items, url);
      return jsonResponse({
        meta: { next: hasNext, previous: hasPrev },
        results: page,
      });
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/errorGroups/:id/path",
    handle: ({ params, url }) => {
      const group = findGroup(params.appId, params.id);
      if (!group) {
        return jsonResponse({ error: "Error group not found" }, 404);
      }
      const bundle = catalog().appById.get(params.appId)!;
      return jsonResponse(
        commonPathFor(
          bundle,
          group,
          groupCount(
            bundle,
            group,
            parseRange(url),
            url.searchParams.get("filter_expr"),
          ),
        ),
      );
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/errorGroups/:id/plots/distribution",
    handle: ({ params, url }) => {
      const group = findGroup(params.appId, params.id);
      if (!group) {
        return jsonResponse({ error: "Error group not found" }, 404);
      }
      const bundle = catalog().appById.get(params.appId)!;
      return jsonResponse(
        distributionFor(
          bundle,
          group,
          parseRange(url),
          url.searchParams.get("filter_expr"),
        ),
      );
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/errorGroups/:id/plots/instances",
    handle: ({ params, url }) => {
      const group = findGroup(params.appId, params.id);
      if (!group) {
        return jsonResponse({ error: "Error group not found" }, 404);
      }
      const range = parseRange(url);
      const bundle = catalog().appById.get(params.appId)!;
      const filterExpr = url.searchParams.get("filter_expr");
      return jsonResponse(
        versionCounts(bundle, group, range, filterExpr)
          .map((version) => ({
            id: version.label,
            data: seriesFor(
              bundle,
              range,
              version.count,
              `errorgroup:${group.id}:${version.name}`,
              version.name,
            ),
          }))
          .sort(byLabel),
      );
    },
  },
];
