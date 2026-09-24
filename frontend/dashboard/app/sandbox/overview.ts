import type { FilterKey, FilterValue } from "../api/filter_types";
import { catalog, computeMetrics, key, sizesFor, values } from "./catalog";
import type { AppBundle, ErrorGroup } from "./catalog";
import {
  adoptionOf,
  groupCount,
  selectedNames,
  versionCoverage,
} from "./adoption";
import { jsonResponse, parseRange, SandboxRoute } from "./query";
import type { SandboxRange } from "./query";
import { countryOf, sessionAttributeBag } from "./filter";
import { derivedSeries, scaledSeries } from "./aggregate";
import { DEVICE_MEMORY_TIERS, MEMORY_APP_STATES } from "./device_memory";

const K = {
  versionName: key(
    "version_name",
    "App version",
    "The version of the app.",
    "Version",
    "string",
    ["in", "not_in", "contains", "starts_with"],
    "sample",
  ),
  versionCode: key(
    "version_code",
    "Build number",
    "The build number (Version Code on Android, Bundle Version on iOS).",
    "Version",
    "string",
    ["in", "not_in"],
    "sample",
  ),
  patchVersion: key(
    "patch_version",
    "Patch version",
    "The version of an Over-The-Air patch.",
    "Version",
    "string",
    ["in", "not_in", "contains"],
    "sample",
  ),
  patchId: key(
    "patch_id",
    "Patch id",
    "The id of an Over-The-Air patch.",
    "Version",
    "uuid",
    ["in", "not_in", "is_set", "is_not_set"],
    "sample",
  ),
  mappingType: key(
    "mapping_type",
    "Mapping type",
    "The kind of symbol file uploaded: proguard, dSYM, ELF debug or JS bundle.",
    "Build",
    "enum",
    ["in", "not_in"],
    "full_list",
  ),
  spanStatus: key(
    "span_status",
    "Span status",
    "Status of the span.",
    "Span",
    "enum",
    ["in", "not_in"],
    "full_list",
  ),
  httpMethod: key(
    "http_method",
    "HTTP method",
    "The HTTP method of the request.",
    "Request",
    "enum",
    ["in", "not_in"],
    "full_list",
  ),
  bugReportStatus: key(
    "bug_report_status",
    "Status",
    "Whether the bug report is open or closed.",
    "Bug Report",
    "enum",
    ["in", "not_in"],
    "full_list",
  ),
  errorType: key(
    "error_type",
    "Error Type",
    "Fatal or Non-fatal error types",
    "Error",
    "enum",
    ["in", "not_in"],
    "full_list",
  ),
  sessionEvents: key(
    "session_events",
    "Events",
    "The kinds of events contained in the session.",
    "Session",
    "enum",
    ["in", "not_in"],
    "full_list",
  ),
  sessionCustomEvent: key(
    "session_custom_event",
    "Custom event name",
    "The name of a custom event tracked in the session.",
    "Session",
    "string",
    ["in", "not_in", "contains", "starts_with"],
    "sample",
  ),
  sessionLog: key(
    "session_log",
    "Log",
    "Text of a log message.",
    "Session",
    "string",
    ["contains", "not_contains", "starts_with", "ends_with"],
    "none",
  ),
  sessionErrorText: key(
    "session_error_text",
    "Error text",
    "Text from a crash, ANR or error - name, message, error code, location (source file, class or method)",
    "Session",
    "string",
    ["contains", "not_contains", "starts_with", "ends_with"],
    "none",
  ),
  sessionScreen: key(
    "session_screen",
    "Screen",
    "A screen shown in the session: a screen view name, or an activity, fragment or view controller class name.",
    "Session",
    "string",
    ["in", "not_in", "contains", "starts_with"],
    "sample",
  ),
  sessionForegroundBackground: key(
    "session_foreground_background",
    "Foreground/Background",
    "Whether the session ran in the foreground, background, or both.",
    "Session",
    "enum",
    ["in", "not_in"],
    "full_list",
  ),
  appState: key(
    "app_state",
    "App state",
    "Whether the app was in the foreground, running a user-perceived service, or in the background. Android only.",
    "Memory",
    "enum",
    ["eq"],
    "full_list",
  ),
  deviceTotalMemory: key(
    "device_total_memory",
    "Device total memory",
    "The total memory of the device.",
    "Device",
    "enum",
    ["in", "not_in"],
    "full_list",
  ),
  userId: key(
    "user_id",
    "User ID",
    "The user id of the session.",
    "User",
    "string",
    ["in", "not_in", "contains", "starts_with"],
    "sample",
  ),
  bugReportDescription: key(
    "bug_report_description",
    "Description",
    "The bug report description written by the reporter.",
    "Bug Report",
    "string",
    ["contains", "not_contains", "starts_with", "ends_with"],
    "none",
  ),
  sessionId: key(
    "session_id",
    "Session ID",
    "The id of the session.",
    "Session",
    "uuid",
    ["in", "not_in"],
    "none",
  ),
  osName: key(
    "os_name",
    "OS name",
    "The name of the operating system.",
    "OS",
    "string",
    ["in", "not_in"],
    "sample",
  ),
  osVersion: key(
    "os_version",
    "OS version",
    "The version of the operating system.",
    "OS",
    "string",
    ["in", "not_in", "contains", "starts_with"],
    "sample",
  ),
  deviceName: key(
    "device_name",
    "Device name",
    "The name of the device.",
    "Device",
    "string",
    ["in", "not_in", "contains", "starts_with"],
    "sample",
  ),
  deviceManufacturer: key(
    "device_manufacturer",
    "Device manufacturer",
    "The manufacturer of the device.",
    "Device",
    "string",
    ["in", "not_in"],
    "sample",
  ),
  locale: key(
    "locale",
    "Locale",
    "The device locale.",
    "Device",
    "string",
    ["in", "not_in"],
    "sample",
  ),
  networkType: key(
    "network_type",
    "Network type",
    "The kind of network connection: wifi, cellular and so on.",
    "Network",
    "string",
    ["in", "not_in"],
    "sample",
  ),
  networkGeneration: key(
    "network_generation",
    "Network generation",
    "The cellular network generation: 2g, 3g, 4g and so on.",
    "Network",
    "string",
    ["in", "not_in"],
    "sample",
  ),
  networkProvider: key(
    "network_provider",
    "Network provider",
    "The name of the network service provider.",
    "Network",
    "string",
    ["in", "not_in"],
    "sample",
  ),
  country: key(
    "country",
    "Country",
    "The country the device was in, as a country code.",
    "Location",
    "string",
    ["in", "not_in"],
    "sample",
  ),
};

const versionKeys: FilterKey[] = [
  K.versionName,
  K.versionCode,
  K.patchVersion,
  K.patchId,
];

const deviceTailKeys: FilterKey[] = [
  K.osName,
  K.osVersion,
  K.deviceName,
  K.deviceManufacturer,
  K.locale,
  K.networkType,
  K.networkGeneration,
  K.networkProvider,
  K.country,
];

const KEY_GROUP_ORDER = [
  "Error",
  "Bug Report",
  "Session",
  "Memory",
  "Span",
  "Request",
  "Build",
  "Version",
  "User",
  "OS",
  "Device",
  "Network",
  "Location",
  "Custom",
];

function keyGroupsOf(keys: FilterKey[]): string[] {
  const present = new Set(keys.map((k) => k.key_group));
  return KEY_GROUP_ORDER.filter((group) => present.has(group));
}

const KEYS_BY_ENTITY: Record<string, FilterKey[]> = {
  app_health: [K.versionName, K.versionCode],
  journeys: versionKeys,
  errors: [K.errorType, ...versionKeys, K.userId, ...deviceTailKeys],
  error_group_events: [...versionKeys, K.userId, ...deviceTailKeys],
  sessions: [
    K.sessionEvents,
    K.sessionForegroundBackground,
    K.deviceTotalMemory,
    K.sessionCustomEvent,
    K.sessionLog,
    K.sessionScreen,
    K.sessionErrorText,
    K.sessionId,
    ...versionKeys,
    K.userId,
    ...deviceTailKeys,
  ],
  bug_reports: [
    K.bugReportStatus,
    K.bugReportDescription,
    K.sessionId,
    ...versionKeys,
    K.userId,
    ...deviceTailKeys,
  ],
  memory: [
    K.appState,
    ...versionKeys,
    K.osName,
    K.osVersion,
    K.deviceName,
    K.deviceManufacturer,
    K.deviceTotalMemory,
  ],
  network: [K.httpMethod, ...versionKeys, ...deviceTailKeys],
  builds: [K.mappingType, ...versionKeys],
  spans: [K.spanStatus, ...versionKeys, ...deviceTailKeys],
  // The backend advertises no filter keys for alerts, so the alerts page renders
  // its filter bar as unavailable.
  alerts: [],
};

const FILTER_KEYS_BY_ENTITY: Record<
  string,
  { keys: FilterKey[]; key_groups: string[] }
> = Object.fromEntries(
  Object.entries(KEYS_BY_ENTITY).map(([entity, keys]) => [
    entity,
    { keys, key_groups: keyGroupsOf(keys) },
  ]),
);

function distinct(raw: (string | undefined)[]): string[] {
  return Array.from(new Set(raw.filter((v): v is string => !!v)));
}

function appWideValues(bundle: AppBundle, keyName: string): string[] | null {
  const app = bundle.scenario.app;
  const attrs = bundle.sessions.map((s) => s.detail.attribute);
  switch (keyName) {
    case "version_name":
      return app.versions.map((v) => v.name);
    case "version_code":
      return app.versions.map((v) => v.code);
    case "os_name":
      return distinct(attrs.map((a) => a.os_name));
    case "os_version":
      return distinct(attrs.map((a) => a.os_version));
    case "device_name":
      return distinct(attrs.map((a) => a.device_name));
    case "device_manufacturer":
      return distinct(attrs.map((a) => a.device_manufacturer));
    case "locale":
      return distinct(attrs.map((a) => a.device_locale));
    case "country":
      return distinct(attrs.map((a) => countryOf(a.device_locale)));
    case "network_type":
      return distinct(attrs.map((a) => a.network_type));
    case "network_generation":
      return distinct(attrs.map((a) => a.network_generation));
    case "network_provider":
      return distinct(attrs.map((a) => a.network_provider));
    case "user_id":
      return distinct(attrs.map((a) => a.user_id));
  }
  return null;
}

function actualValuesFor(
  appId: string,
  entity: string,
  keyName: string,
): string[] | null {
  const bundle = catalog().appById.get(appId);
  if (!bundle) {
    return null;
  }
  if (entity === "builds") {
    switch (keyName) {
      case "version_name":
        return distinct(bundle.builds.map((b) => b.version_name));
      case "version_code":
        return distinct(bundle.builds.map((b) => b.version_code));
    }
    return null;
  }
  if (entity === "bug_reports") {
    const reports = bundle.bugReports.map((r) => r.attribute);
    switch (keyName) {
      case "version_name":
        return distinct(reports.map((a) => a.app_version));
      case "version_code":
        return distinct(reports.map((a) => a.app_build));
      case "country":
        return distinct(reports.map((a) => countryOf(a.device_locale)));
      case "device_name":
        return distinct(reports.map((a) => a.device_name));
      case "device_manufacturer":
        return distinct(reports.map((a) => a.device_manufacturer));
      case "locale":
        return distinct(reports.map((a) => a.device_locale));
      case "os_name":
        return distinct(reports.map((a) => a.os_name));
      case "os_version":
        return distinct(reports.map((a) => a.os_version));
      case "network_type":
        return distinct(reports.map((a) => a.network_type));
      case "network_generation":
        return distinct(reports.map((a) => a.network_generation));
      case "network_provider":
        return distinct(reports.map((a) => a.network_provider));
      case "user_id":
        return distinct(reports.map((a) => a.user_id));
    }
    return null;
  }
  if (
    entity === "sessions" &&
    (keyName === "session_screen" || keyName === "session_custom_event")
  ) {
    return distinct(
      bundle.sessions.flatMap(
        (s) => sessionAttributeBag(s.detail)[keyName] as string[],
      ),
    );
  }
  return appWideValues(bundle, keyName);
}

const STATIC_VALUES_BY_KEY: Record<string, FilterValue[]> = {
  error_type: values(["Crash", "ANR", "Handled Error", "Unhandled Error"]),
  http_method: values(["get", "post", "put", "patch", "delete"]),
  mapping_type: values(["proguard", "dsym", "elf_debug", "jsbundle"]),
  bug_report_status: [
    { text: "open", label: "Open" },
    { text: "closed", label: "Closed" },
  ],
  span_status: values(["unset", "ok", "error"]),
  session_events: values([
    "fatal_error",
    "unhandled_error",
    "handled_error",
    "anr",
    "bug_report",
    "user_interaction",
  ]),
  session_foreground_background: values(["foreground", "background"]),
  device_total_memory: values(DEVICE_MEMORY_TIERS),
  app_state: values([...MEMORY_APP_STATES]),
};

// The backend builds the node and link slices only from sessions in range,
// so an empty range serializes them as null.
const EMPTY_JOURNEY = { totalIssues: 0, nodes: null, links: null };

function journeyFor(
  bundle: AppBundle,
  range: SandboxRange,
  filterExpr: string | null,
) {
  const names = selectedNames(bundle.scenario.app, filterExpr);
  const coverage = versionCoverage(bundle, range, names);
  if (coverage <= 0) {
    return EMPTY_JOURNEY;
  }
  const groupById = new Map(bundle.errorGroups.map((g) => [g.id, g]));
  const scaleIssue = (issue: { id: string; title: string; count: number }) => {
    const group = groupById.get(issue.id);
    return {
      ...issue,
      count: group ? groupCount(bundle, group, range, names) : 0,
    };
  };
  const nodes = bundle.journey.nodes.map((node) => ({
    ...node,
    issues: {
      crashes: node.issues.crashes.map(scaleIssue),
      anrs: node.issues.anrs.map(scaleIssue),
    },
  }));
  return {
    links: bundle.journey.links.map((link) => ({
      ...link,
      value: Math.round(link.value * coverage),
    })),
    nodes,
    totalIssues: nodes.reduce(
      (sum, node) =>
        sum +
        node.issues.crashes.reduce((a, i) => a + i.count, 0) +
        node.issues.anrs.reduce((a, i) => a + i.count, 0),
      0,
    ),
  };
}

export const overviewRoutes: SandboxRoute[] = [
  {
    method: "GET",
    path: "/api/apps/:appId/metrics",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      if (!bundle) {
        return jsonResponse({ error: "App not found" }, 404);
      }
      const filterExpr = url.searchParams.get("filter_expr");
      const sizes = sizesFor(
        bundle,
        selectedNames(bundle.scenario.app, filterExpr),
      );
      return jsonResponse({
        ...computeMetrics(bundle, filterExpr, parseRange(url)),
        sizes,
      });
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/health/plots/instances",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      if (!bundle) {
        return jsonResponse([]);
      }
      const range = parseRange(url);
      const filterExpr = url.searchParams.get("filter_expr");
      const app = bundle.scenario.app;
      const names = selectedNames(app, filterExpr);
      const dataStart = bundle.dataStart;
      const fatalTotal = (errorType: ErrorGroup["error_type"]) =>
        bundle.errorGroups
          .filter((g) => g.error_type === errorType && g.severity === "fatal")
          .reduce((sum, g) => sum + groupCount(bundle, g, range, names), 0);
      const crashesTotal = fatalTotal("exception");
      const anrsTotal = fatalTotal("anr");
      const sessions = scaledSeries(
        range,
        app.dailySessions * 30,
        dataStart,
        `health:sessions:${app.id}`,
        app.id,
        adoptionOf(bundle.releases, names),
      );
      return jsonResponse([
        { id: "sessions", data: sessions },
        {
          id: "crashes",
          data: derivedSeries(
            range,
            crashesTotal,
            dataStart,
            `health:crashes:${app.id}`,
            sessions,
          ),
        },
        {
          id: "anrs",
          data: derivedSeries(
            range,
            anrsTotal,
            dataStart,
            `health:anrs:${app.id}`,
            sessions,
          ),
        },
      ]);
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/journey",
    handle: ({ params, url }) => {
      const bundle = catalog().appById.get(params.appId);
      if (!bundle) {
        return jsonResponse(EMPTY_JOURNEY);
      }
      return jsonResponse(
        journeyFor(
          bundle,
          parseRange(url),
          url.searchParams.get("filter_expr"),
        ),
      );
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/filters/keys",
    handle: ({ url }) => {
      const entity = url.searchParams.get("entity") ?? "";
      return jsonResponse(
        FILTER_KEYS_BY_ENTITY[entity] ?? { keys: [], key_groups: [] },
      );
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/filters/values",
    handle: ({ params, url }) => {
      const entity = url.searchParams.get("entity") ?? "";
      const keyName = url.searchParams.get("key_name") ?? "";
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const actual = actualValuesFor(params.appId, entity, keyName);
      const list =
        actual && actual.length > 0
          ? values(actual)
          : (STATIC_VALUES_BY_KEY[keyName] ?? []);
      const filtered =
        search === ""
          ? list
          : list.filter((v) => v.text.toLowerCase().includes(search));
      return jsonResponse({ values: filtered, truncated: false });
    },
  },
  {
    method: "GET",
    path: "/api/apps/:appId/spans/roots/names",
    handle: ({ params }) => {
      const bundle = catalog().appById.get(params.appId);
      return jsonResponse({ results: bundle?.rootSpanNames ?? [] });
    },
  },
];
