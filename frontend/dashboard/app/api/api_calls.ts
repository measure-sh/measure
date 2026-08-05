/**
 * Every server call the dashboard makes lives in this file, as a function
 * that builds a URL and hands it to `request` below. A fetcher returns the
 * response body.
 *
 * TanStack Query holds whether a call is in flight, and the hooks in
 * app/query/hooks.ts pass that to components.
 *
 * `request` throws on failure: an ApiError when the server answered and
 * rejected the call, carrying the HTTP status, or a RequestError when no
 * answer came back, such as a dropped connection or an unreadable body.
 * Catch ApiError and check `status` where a code is an outcome rather than
 * a fault.
 *
 * An empty result is a return value: null, an empty array, or a
 * discriminated union when the emptiness has several causes the user needs
 * to know about.
 *
 * A new fetcher needs a URL, a failure message naming the operation for
 * when the server sends no error of its own, and a return type.
 */

import {
  formatUserInputDateToServerFormat,
  getPlotTimeGroupForRange,
  getTimeZoneForServer,
} from "../utils/time_utils";
import { navigateTo } from "../utils/navigation";
import { apiClient } from "./api_client";
import { ApiError, RequestError } from "./api_error";

export enum JourneyType {
  Paths,
  Exceptions,
}

export enum FilterSource {
  Events,
  Spans,
  Errors,
  Builds,
}

export enum SessionType {
  FatalErrors = "Fatal Error Sessions",
  UnhandledErrors = "Unhandled Error Sessions",
  HandledErrors = "Handled Error Sessions",
  ANRs = "ANR Sessions",
  BugReports = "Bug Report Sessions",
  UserInteraction = "User Interaction Sessions",
  Foreground = "Foreground Sessions",
  Background = "Background Sessions",
}

export enum SpanStatus {
  Unset = "Unset",
  Ok = "Ok",
  Error = "Error",
}

export enum BugReportStatus {
  Open = "Open",
  Closed = "Closed",
}

export enum HttpMethod {
  GET = "get",
  POST = "post",
  PUT = "put",
  PATCH = "patch",
  DELETE = "delete",
}

export type Team = {
  id: string;
  name: string;
};

export type PendingInvite = {
  id: string;
  invited_by_user_id: string;
  invited_by_email: string;
  invited_to_team_id: string;
  role: string;
  email: string;
  created_at: string;
  updated_at: string;
  valid_until: string;
};

export type App = {
  id: string;
  team_id: string;
  name: string;
  api_key: {
    created_at: string;
    key: string;
    last_seen: string | null;
    revoked: boolean;
  };
  onboarded: boolean;
  created_at: string;
  updated_at: string;
  os_names: string[] | null;
  onboarded_at: string | null;
  unique_identifier: string | null;
};

export const emptyJourney = {
  links: [
    {
      source: "",
      target: "",
      value: 0,
    },
  ],
  nodes: [
    {
      id: "au.com.shiftyjelly.pocketcasts.ui.MainActivity",
      issues: {
        anrs: [
          {
            id: "",
            title: "",
            count: 0,
          },
        ],
        crashes: [
          {
            id: "",
            title: "",
            count: 0,
          },
        ],
      },
    },
  ],
  totalIssues: 0,
};

export const emptyMetrics = {
  adoption: {
    all_versions: 0,
    selected_version: 0,
    adoption: 0,
    nan: false,
  },
  anr_free_sessions: {
    anr_free_sessions: 0,
    delta: 0,
    nan: false,
  },
  cold_launch: {
    delta: 0,
    nan: false,
    p95: 0,
    delta_nan: false,
  },
  crash_free_sessions: {
    crash_free_sessions: 0,
    delta: 0,
    nan: false,
  },
  hot_launch: {
    delta: 0,
    nan: false,
    p95: 0,
    delta_nan: false,
  },
  perceived_anr_free_sessions: {
    perceived_anr_free_sessions: 0,
    delta: 0,
    nan: false,
  },
  perceived_crash_free_sessions: {
    perceived_crash_free_sessions: 0,
    delta: 0,
    nan: false,
  },
  sizes: {
    average_app_size: 0,
    selected_app_size: 0,
    delta: 0,
    nan: false,
  },
  warm_launch: {
    delta: 0,
    nan: false,
    p95: 0,
    delta_nan: false,
  },
};

export const emptySessionReplayOverviewResponse = {
  meta: {
    next: false,
    previous: false,
  },
  results: [] as {
    session_id: string;
    app_id: string;
    first_event_time: string;
    last_event_time: string;
    duration: string;
    matched_free_text: string;
    attribute: {
      app_version: string;
      app_build: string;
      user_id: string;
      device_name: string;
      device_model: string;
      device_manufacturer: string;
      os_name: string;
      os_version: string;
    };
  }[],
};

export const emptySpansResponse = {
  meta: {
    next: false,
    previous: false,
  },
  results: [] as {
    app_id: string;
    span_name: string;
    span_id: string;
    trace_id: string;
    status: number;
    start_time: string;
    end_time: string;
    duration: number;
    app_version: string;
    app_build: string;
    os_name: string;
    os_version: string;
    device_manufacturer: string;
    device_model: string;
  }[],
};

export const emptyErrorGroup = {
  id: "",
  app_id: "",
  type: "",
  error_type: "",
  severity: "",
  is_custom: false,
  message: "",
  method_name: "",
  file_name: "",
  line_number: 0,
  count: 0,
  percentage_contribution: 0,
  updated_at: "",
};

export const emptyErrorsOverviewResponse = {
  meta: {
    next: false,
    previous: false,
  },
  results: [] as (typeof emptyErrorGroup)[],
};

const emptyErrorGroupDetailsItem = {
  id: "",
  session_id: "",
  timestamp: "",
  type: "",
  attribute: {
    installation_id: "",
    app_version: "",
    app_build: "",
    app_unique_id: "",
    measure_sdk_version: "",
    platform: "",
    thread_name: "",
    user_id: "",
    device_name: "",
    device_model: "",
    device_manufacturer: "",
    device_type: "",
    device_is_foldable: false,
    device_is_physical: false,
    device_density_dpi: 0,
    device_width_px: 0,
    device_height_px: 0,
    device_density: 0.0,
    device_locale: "",
    device_low_power_mode: false,
    device_thermal_throttling_enabled: false,
    device_cpu_arch: "",
    os_name: "",
    os_version: "",
    os_page_size: 0,
    network_type: "",
    network_provider: "",
    network_generation: "",
  },
  exception: {
    title: "",
    stacktrace: "",
    message: "",
  } as { title: string; stacktrace: string; message: string } | null,
  anr: {
    title: "",
    stacktrace: "",
  } as { title: string; stacktrace: string } | null,
  severity: "",
  num_code: 0 as number | null,
  code: "",
  meta: null as Record<string, unknown> | null,
  user_defined_attribute: null as Record<string, unknown> | null,
  attachments: [
    {
      id: "",
      name: "",
      type: "",
      key: "",
      location: "",
    },
  ],
  threads: [
    {
      name: "",
      frames: [""],
    },
  ],
};

export const emptyErrorGroupDetails = {
  meta: {
    next: true,
    previous: false,
  },
  results: [] as (typeof emptyErrorGroupDetailsItem)[],
};

export const defaultAuthzAndMembers = {
  can_invite_roles: ["viewer"],
  can_update_bug_reports: false,
  can_change_billing: false,
  can_create_app: false,
  can_rename_app: false,
  can_change_retention: false,
  can_rotate_api_key: false,
  can_write_sdk_config: false,
  can_rename_team: false,
  can_manage_slack: false,
  can_change_app_threshold_prefs: false,
  members: [
    {
      id: "",
      name: null,
      email: "",
      role: "",
      last_sign_in_at: "",
      created_at: "",
      authz: {
        current_user_assignable_roles_for_member: [""],
        current_user_can_remove_member: true,
      },
    },
  ],
};

export const defaultAppThresholdPrefs = {
  error_good_threshold: 95,
  error_caution_threshold: 85,
  error_spike_min_count_threshold: 100,
  error_spike_min_rate_threshold: 0.5,
};

export const emptyTrace = {
  app_id: "",
  trace_id: "",
  session_id: "",
  user_id: "",
  start_time: "",
  end_time: "",
  duration: 0,
  app_version: "",
  os_version: "",
  device_model: "",
  device_manufacturer: "",
  network_type: "",
  spans: [
    {
      span_name: "",
      span_id: "",
      parent_id: "",
      status: 0,
      start_time: "",
      end_time: "",
      duration: 0,
      thread_name: "",
      user_defined_attributes: null,
      checkpoints: [
        {
          name: "",
          timestamp: "",
        },
      ],
    },
  ],
};

export const emptyNotifPrefs = {
  error_spike: true,
  app_hang_spike: true,
  bug_report: true,
  daily_summary: true,
};

export const emptyAppRetention = {
  retention: 30,
};

export const emptyUsage = [
  {
    app_id: "",
    app_name: "",
    monthly_app_usage: [
      {
        month_year: "",
        sessions: 0,
        events: 0,
        spans: 0,
        bytes_in: 0,
      },
    ],
  },
];

export const emptyBugReportsOverviewResponse = {
  meta: {
    next: false,
    previous: false,
  },
  results: [] as {
    session_id: string;
    app_id: string;
    event_id: string;
    status: number;
    description: string;
    timestamp: string;
    attribute: {
      installation_id: string;
      app_version: string;
      app_build: string;
      app_unique_id: string;
      measure_sdk_version: string;
      platform: string;
      thread_name: string;
      user_id: string;
      device_name: string;
      device_model: string;
      device_manufacturer: string;
      device_type: string;
      device_is_foldable: boolean;
      device_is_physical: boolean;
      device_density_dpi: number;
      device_width_px: number;
      device_height_px: number;
      device_density: number;
      device_locale: string;
      device_low_power_mode: boolean;
      device_thermal_throttling_enabled: boolean;
      device_cpu_arch: string;
      os_name: string;
      os_version: string;
      os_page_size: number;
      network_type: string;
      network_provider: string;
      network_generation: string;
    };
    user_defined_attribute: null;
    attachments: null;
    matched_free_text: string;
  }[],
};

export const emptyBuildsResponse = {
  meta: {
    next: false,
    previous: false,
  },
  results: [] as {
    version_name: string;
    version_code: string;
    patch_id?: string;
    last_updated: string;
    files: {
      id: string;
      mapping_type: string;
      download_url: string;
      filesize: number;
      last_updated: string;
    }[];
  }[],
};

export const emptyBugReport = {
  session_id: "",
  app_id: "",
  event_id: "",
  status: 0,
  description: "",
  timestamp: "",
  attribute: {
    installation_id: "",
    app_version: "",
    app_build: "",
    app_unique_id: "",
    measure_sdk_version: "",
    platform: "",
    thread_name: "",
    user_id: "",
    device_name: "",
    device_model: "",
    device_manufacturer: "",
    device_type: "",
    device_is_foldable: false,
    device_is_physical: false,
    device_density_dpi: 0,
    device_width_px: 0,
    device_height_px: 0,
    device_density: 0,
    device_locale: "",
    device_low_power_mode: false,
    device_thermal_throttling_enabled: false,
    device_cpu_arch: "",
    os_name: "",
    os_version: "",
    os_page_size: 0,
    network_type: "",
    network_provider: "",
    network_generation: "",
  },
  user_defined_attribute: null,
  attachments: [
    {
      id: "",
      name: "",
      type: "",
      key: "",
      location: "",
    },
  ],
};

export const emptyAlertsOverviewResponse = {
  meta: {
    next: false,
    previous: false,
  },
  results: [] as {
    id: string;
    team_id: string;
    app_id: string;
    entity_id: string;
    type: string;
    message: string;
    url: string;
    created_at: string;
    updated_at: string;
  }[],
};

export type SdkConfig = {
  trace_sampling_rate: number;
  crash_timeline_duration: number;
  crash_take_screenshot: boolean;
  anr_timeline_duration: number;
  anr_take_screenshot: boolean;
  bug_report_timeline_duration: number;
  launch_sampling_rate: number;
  journey_sampling_rate: number;
  http_sampling_rate: number;
  http_disable_event_for_urls: string[];
  http_track_request_for_urls: string[];
  http_track_response_for_urls: string[];
  http_blocked_headers: string[];
  screenshot_mask_level: string;
  profile_sampling_rate: number;
  log_autocollect_enabled: boolean;
  log_min_severity: number;
  log_ignore_patterns: string[];
};
export class AppVersion {
  name: string;
  code: string;
  displayName: string;

  constructor(name: string, code: string) {
    this.name = name;
    this.code = code;
    this.displayName = this.name + " (" + this.code + ")";
  }
}

export class OsVersion {
  name: string;
  version: string;
  displayName: string;

  constructor(name: string, version: string) {
    this.name = name;
    this.version = version;
    this.displayName =
      (name === "android"
        ? "Android API Level"
        : name === "ios"
          ? "iOS"
          : name === "ipados"
            ? "iPadOS"
            : name) +
      " " +
      this.version;
  }
}

export type UserDefAttr = {
  key: string;
  type: string;
};

export type UdAttrMatcher = {
  key: string;
  type: string;
  op: string;
  value: string | number | boolean;
};

export type Filters = {
  ready: boolean;
  loading: boolean;
  app: App | null;
  rootSpanName: string;
  startDate: string;
  endDate: string;
  versions: { selected: AppVersion[]; all: boolean };
  sessionTypes: { selected: SessionType[]; all: boolean };
  spanStatuses: { selected: SpanStatus[]; all: boolean };
  bugReportStatuses: { selected: BugReportStatus[]; all: boolean };
  httpMethods: { selected: HttpMethod[]; all: boolean };
  osVersions: { selected: OsVersion[]; all: boolean };
  countries: { selected: string[]; all: boolean };
  networkProviders: { selected: string[]; all: boolean };
  networkTypes: { selected: string[]; all: boolean };
  networkGenerations: { selected: string[]; all: boolean };
  locales: { selected: string[]; all: boolean };
  deviceManufacturers: { selected: string[]; all: boolean };
  deviceNames: { selected: string[]; all: boolean };
  udAttrMatchers: UdAttrMatcher[];
  freeText: string;
  selectedErrorTypes: string[];
  selectedSeverities: string[];
  customErrorsOnly: boolean;
  serialisedFilters: string | null;
  // Resolves to the server-side filter_short_code for this filter combination.
  // Set by the filters store when filters change. URL builders await this
  // instead of POSTing /shortFilters themselves, so there is exactly one POST
  // per filter change regardless of how many parallel data fetchers run.
  filterShortCodePromise: Promise<string | null>;
};

export const defaultFilters: Filters = {
  ready: false,
  loading: true,
  app: null,
  rootSpanName: "",
  startDate: "",
  endDate: "",
  versions: { selected: [], all: false },
  sessionTypes: { selected: [], all: false },
  spanStatuses: { selected: [], all: false },
  bugReportStatuses: { selected: [], all: false },
  httpMethods: { selected: [], all: false },
  osVersions: { selected: [], all: false },
  countries: { selected: [], all: false },
  networkProviders: { selected: [], all: false },
  networkTypes: { selected: [], all: false },
  networkGenerations: { selected: [], all: false },
  locales: { selected: [], all: false },
  deviceManufacturers: { selected: [], all: false },
  deviceNames: { selected: [], all: false },
  udAttrMatchers: [],
  freeText: "",
  selectedErrorTypes: [],
  selectedSeverities: [],
  customErrorsOnly: false,
  serialisedFilters: null,
  filterShortCodePromise: Promise.resolve(null),
};

/**
 * Builds the body that `saveListFiltersToServer` would POST to /shortFilters,
 * or returns `null` when there is nothing to register with the server.
 *
 * This is the single source of truth for what makes a filter "different"
 * from the server's point of view. The filters store imports it and hashes
 * the result to decide when to kick off a fresh POST — so any change to
 * this function's output must equivalently change that hash.
 */
export const buildShortFiltersPostBody = (
  filters: Filters,
): { filters: any } | null => {
  if (
    filters.versions.selected.length === 0 &&
    filters.osVersions.selected.length === 0 &&
    filters.countries.selected.length === 0 &&
    filters.networkProviders.selected.length === 0 &&
    filters.networkTypes.selected.length === 0 &&
    filters.networkGenerations.selected.length === 0 &&
    filters.locales.selected.length === 0 &&
    filters.deviceManufacturers.selected.length === 0 &&
    filters.deviceNames.selected.length === 0 &&
    filters.udAttrMatchers.length === 0
  ) {
    return null;
  }

  // we always include app versions regardless of whether all are selected for more efficient filtering on backend
  const bodyFilters: any = {
    versions: filters.versions.selected.map((v) => v.name),
    version_codes: filters.versions.selected.map((v) => v.code),
    os_names: filters.osVersions.all
      ? []
      : filters.osVersions.selected.map((v) => v.name),
    os_versions: filters.osVersions.all
      ? []
      : filters.osVersions.selected.map((v) => v.version),
    countries: filters.countries.all ? [] : filters.countries.selected,
    network_providers: filters.networkProviders.all
      ? []
      : filters.networkProviders.selected,
    network_types: filters.networkTypes.all
      ? []
      : filters.networkTypes.selected,
    network_generations: filters.networkGenerations.all
      ? []
      : filters.networkGenerations.selected,
    locales: filters.locales.all ? [] : filters.locales.selected,
    device_manufacturers: filters.deviceManufacturers.all
      ? []
      : filters.deviceManufacturers.selected,
    device_names: filters.deviceNames.all ? [] : filters.deviceNames.selected,
  };

  if (filters.udAttrMatchers.length > 0) {
    bodyFilters.ud_expression = JSON.stringify({
      and: filters.udAttrMatchers.map((matcher) => ({
        cmp: {
          key: matcher.key,
          type: matcher.type,
          op: matcher.op,
          value: String(matcher.value),
        },
      })),
    });
  }

  return { filters: bodyFilters };
};

/**
 * POSTs the current filter combination to the server and returns the
 * server-issued short code. Called exactly once per real filter change by
 * the filters store; URL builders read the resulting promise via
 * `filters.filterShortCodePromise` rather than calling this directly.
 */
export const saveListFiltersToServer = async (
  filters: Filters,
): Promise<string | null> => {
  const body = buildShortFiltersPostBody(filters);
  if (body === null) {
    return null;
  }

  const url = `/api/apps/${filters.app!.id}/shortFilters`;

  try {
    const res = await apiClient.fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.filter_short_code;
  } catch {
    return null;
  }
};

async function applyGenericFiltersToUrl(
  url: string,
  filters: Filters,
  limit: number | null,
  offset: number | null,
) {
  const serverFormattedStartDate = formatUserInputDateToServerFormat(
    filters.startDate,
  );
  const serverFormattedEndDate = formatUserInputDateToServerFormat(
    filters.endDate,
  );
  const timezone = getTimeZoneForServer();

  const u = new URL(url, window.location.origin);
  const searchParams = new URLSearchParams();

  searchParams.append("from", serverFormattedStartDate);
  searchParams.append("to", serverFormattedEndDate);
  searchParams.append("timezone", timezone);

  // The filters store has already kicked off the /shortFilters POST when
  // filters changed and stored the promise on the filters object — just await
  // it here. No POST happens in this function.
  const filterShortCode = await filters.filterShortCodePromise;

  if (filterShortCode !== null) {
    searchParams.append("filter_short_code", filterShortCode);
  }

  // Session-type filtering is intentionally NOT applied here. Callers that
  // want it must invoke appendSessionTypesToUrl() explicitly after this fn.
  // This keeps the URL builders composable and prevents session-type params
  // leaking onto endpoints that don't filter by session content (e.g.
  // /errorGroups, which uses its own `type` param for selectedErrorTypes).

  // Append span name if needed
  if (filters.rootSpanName !== "") {
    searchParams.append("span_name", encodeURIComponent(filters.rootSpanName));
  }

  // Append span statuses if needed
  if (!filters.spanStatuses.all && filters.spanStatuses.selected.length > 0) {
    filters.spanStatuses.selected.forEach((v) => {
      if (v === SpanStatus.Unset) {
        searchParams.append("span_statuses", "0");
      } else if (v === SpanStatus.Ok) {
        searchParams.append("span_statuses", "1");
      } else if (v === SpanStatus.Error) {
        searchParams.append("span_statuses", "2");
      }
    });
  }

  // Append bug report statuses if needed
  if (
    !filters.bugReportStatuses.all &&
    filters.bugReportStatuses.selected.length > 0
  ) {
    filters.bugReportStatuses.selected.forEach((v) => {
      if (v === BugReportStatus.Open) {
        searchParams.append("bug_report_statuses", "0");
      } else if (v === BugReportStatus.Closed) {
        searchParams.append("bug_report_statuses", "1");
      }
    });
  }

  // Append free text if present
  if (filters.freeText !== "") {
    searchParams.append("free_text", filters.freeText);
  }

  // Append limit if present
  if (limit !== null) {
    searchParams.append("limit", String(limit));
  }

  // Append offset if present
  if (offset !== null) {
    searchParams.append("offset", String(offset));
  }

  u.search = searchParams.toString();

  return u.toString();
}

function appendPlotTimeGroupToUrl(url: string, filters: Filters): string {
  const u = new URL(url, window.location.origin);
  u.searchParams.set(
    "plot_time_group",
    getPlotTimeGroupForRange(filters.startDate, filters.endDate),
  );
  return u.toString();
}

function appendSessionTypesToUrl(url: string, filters: Filters): string {
  const u = new URL(url, window.location.origin);
  if (!filters.sessionTypes.all && filters.sessionTypes.selected.length > 0) {
    // The three error severities all imply type=error; we collect the
    // severities separately so the URL emits e.g. type=error,anr and
    // severity=fatal,handled — matching the errors-endpoint contract.
    const types = new Set<string>();
    const severities = new Set<string>();
    filters.sessionTypes.selected.forEach((v) => {
      switch (v) {
        case SessionType.FatalErrors:
          types.add("error");
          severities.add("fatal");
          break;
        case SessionType.UnhandledErrors:
          types.add("error");
          severities.add("unhandled");
          break;
        case SessionType.HandledErrors:
          types.add("error");
          severities.add("handled");
          break;
        case SessionType.ANRs:
          types.add("anr");
          break;
        case SessionType.BugReports:
          u.searchParams.append("bug_report", "1");
          break;
        case SessionType.UserInteraction:
          u.searchParams.append("user_interaction", "1");
          break;
        case SessionType.Foreground:
          u.searchParams.append("foreground", "1");
          break;
        case SessionType.Background:
          u.searchParams.append("background", "1");
          break;
      }
    });
    if (types.size > 0) {
      u.searchParams.append("type", Array.from(types).join(","));
    }
    if (severities.size > 0) {
      u.searchParams.append("severity", Array.from(severities).join(","));
    }
  }
  return u.toString();
}

function appendSpanFiltersToUrl(url: string, filters: Filters): string {
  const u = new URL(url, window.location.origin);
  if (filters.rootSpanName !== "") {
    u.searchParams.append(
      "span_name",
      encodeURIComponent(filters.rootSpanName),
    );
  }
  if (!filters.spanStatuses.all && filters.spanStatuses.selected.length > 0) {
    filters.spanStatuses.selected.forEach((v) => {
      if (v === SpanStatus.Unset) {
        u.searchParams.append("span_statuses", "0");
      } else if (v === SpanStatus.Ok) {
        u.searchParams.append("span_statuses", "1");
      } else if (v === SpanStatus.Error) {
        u.searchParams.append("span_statuses", "2");
      }
    });
  }
  return u.toString();
}

function appendBugReportStatusesToUrl(url: string, filters: Filters): string {
  const u = new URL(url, window.location.origin);
  if (
    !filters.bugReportStatuses.all &&
    filters.bugReportStatuses.selected.length > 0
  ) {
    filters.bugReportStatuses.selected.forEach((v) => {
      if (v === BugReportStatus.Open) {
        u.searchParams.append("bug_report_statuses", "0");
      } else if (v === BugReportStatus.Closed) {
        u.searchParams.append("bug_report_statuses", "1");
      }
    });
  }
  return u.toString();
}

function appendHttpMethodsToUrl(url: string, filters: Filters): string {
  const u = new URL(url, window.location.origin);
  if (!filters.httpMethods.all && filters.httpMethods.selected.length > 0) {
    filters.httpMethods.selected.forEach((v) => {
      u.searchParams.append("http_methods", v);
    });
  }
  return u.toString();
}

/**
 * The options for `request`. `failsWith` is the message that the user sees
 * when the server sends no error of its own. The other options go to fetch.
 */
type RequestOptions = RequestInit & {
  failsWith: string;
  /**
   * Set false when body parsing is not needed. Leaving it true on an endpoint
   * that returns no body will cause the parse to throw and fail the call.
   */
  parseBody?: boolean;
};

/**
 * Sends a request and returns its parsed body. A server rejection becomes
 * an ApiError carrying the status, and anything that stops the request
 * itself from executing becomes a RequestError named after the operation.
 */
function request(
  url: string,
  opts: RequestOptions & { parseBody: false },
): Promise<void>;
function request<T = any>(url: string, opts: RequestOptions): Promise<T>;
async function request<T = any>(
  url: string,
  { failsWith, parseBody = true, ...init }: RequestOptions,
): Promise<T | void> {
  let res: Response;
  try {
    res = await apiClient.fetch(url, init);
  } catch (e) {
    throw new RequestError(failsWith, { cause: e });
  }

  if (!res.ok) {
    // A rejected request does not always have a JSON body. A proxy can send
    // an HTML error page, so use our own message when the parse fails.
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? failsWith);
  }

  if (!parseBody) {
    return;
  }

  try {
    return (await res.json()) as T;
  } catch (e) {
    throw new RequestError(failsWith, { cause: e });
  }
}

export const validateInvitesFromServer = async (inviteId: string) => {
  try {
    await request(`/api/auth/validateInvite`, {
      method: "POST",
      body: JSON.stringify({ invite_id: inviteId }),
      failsWith: "Failed to validate invite",
      parseBody: false,
    });
  } catch (e) {
    if (e instanceof ApiError) {
      console.log("Validate invite failed with status:", e.status);
    } else {
      console.log("Validate invite cancelled due to exception");
    }
    throw e;
  }

  console.log("Validate invite succeeded");
};

export const fetchTeamsFromServer = async () => {
  const data: [{ id: string; name: string }] = await request(`/api/teams`, {
    failsWith: "Failed to fetch teams",
  });

  return data;
};

export const fetchAppsFromServer = async (teamId: string): Promise<App[]> => {
  try {
    return await request<App[]>(`/api/teams/${teamId}/apps`, {
      failsWith: "Failed to fetch apps",
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return [];
    }
    throw e;
  }
};

export const fetchRootSpanNamesFromServer = async (
  selectedApp: App,
): Promise<string[] | null> => {
  const failsWith = "Failed to fetch root span names";
  const data = await request(`/api/apps/${selectedApp.id}/spans/roots/names`, {
    failsWith,
  });

  if (data === null) {
    throw new RequestError(failsWith);
  }

  return (data.results as string[] | null) ?? null;
};

export const fetchSpansFromServer = async (
  filters: Filters,
  limit: number,
  offset: number,
) => {
  var url = `/api/apps/${filters.app!.id}/spans?`;

  url = await applyGenericFiltersToUrl(url, filters, limit, offset);
  url = appendSpanFiltersToUrl(url, filters);

  const data = await request(url, { failsWith: "Failed to fetch spans" });

  return data;
};

export const fetchSpanMetricsPlotFromServer = async (filters: Filters) => {
  var url = `/api/apps/${filters.app!.id}/spans/plots/metrics?`;

  url = await applyGenericFiltersToUrl(url, filters, null, null);
  url = appendSpanFiltersToUrl(url, filters);
  url = appendPlotTimeGroupToUrl(url, filters);

  const data = await request(url, {
    failsWith: "Failed to fetch span metrics plot",
  });

  return data;
};

export const fetchTraceFromServer = async (appId: string, traceId: string) => {
  const data = await request(`/api/apps/${appId}/traces/${traceId}`, {
    failsWith: "Failed to fetch trace",
  });

  return data;
};

/**
 * A filters response is a set of options, or one of three empty outcomes.
 * The dashboard explains each empty outcome differently: an app that sent no
 * events, an app with no builds, and an app with no events of this kind.
 */
export type FilterOptionsResult =
  | { kind: "options"; data: any }
  | { kind: "no-data" }
  | { kind: "not-onboarded" }
  | { kind: "no-builds" };

export const fetchFiltersFromServer = async (
  selectedApp: App,
  filterSource: FilterSource,
): Promise<FilterOptionsResult> => {
  let url = `/api/apps/${selectedApp.id}/filters`;

  // fetch the user defined attributes
  url += "?ud_attr_keys=1";

  // if filter is for Spans, Errors or Builds we append a query param
  // indicating it
  if (filterSource === FilterSource.Spans) {
    url += "&span=1";
  } else if (filterSource === FilterSource.Errors) {
    url += "&type=error,anr";
  } else if (filterSource === FilterSource.Builds) {
    url += "&builds=1";
  }

  const failsWith = "Failed to fetch filters";
  const data = await request(url, { failsWith });

  if (data === null) {
    throw new RequestError(failsWith);
  }

  if (data.versions === null) {
    // Builds are uploaded independently of event data, so an empty
    // builds source means no builds
    if (filterSource === FilterSource.Builds) {
      return { kind: "no-builds" };
    }
    if (!selectedApp.onboarded) {
      return { kind: "not-onboarded" };
    }
    return { kind: "no-data" };
  }

  return { kind: "options", data };
};

export const fetchAppHealthPlotFromServer = async (filters: Filters) => {
  let url = `/api/apps/${filters.app!.id}/health/plots/instances?`;

  url = await applyGenericFiltersToUrl(url, filters, null, null);
  url = appendPlotTimeGroupToUrl(url, filters);

  const data = await request(url, {
    failsWith: "Failed to fetch app health plot",
  });

  if (data === null) {
    return null;
  }

  // The server returns three sparse series keyed by id: "sessions", "crashes"
  // and "anrs", each with { datetime, instances } points. Collapse each into a
  // date -> count map.
  const dateMaps: Record<string, Record<string, number>> = {
    sessions: {},
    crashes: {},
    anrs: {},
  };
  for (const series of data || []) {
    const dateMap = dateMaps[series.id];
    if (dateMap === undefined) {
      continue;
    }
    for (const point of series.data || []) {
      dateMap[point.datetime] =
        (dateMap[point.datetime] || 0) + (point.instances ?? 0);
    }
  }

  // Align all three series on the same sorted set of dates, zero-filling gaps.
  const allDates = Array.from(
    new Set([
      ...Object.keys(dateMaps.sessions),
      ...Object.keys(dateMaps.crashes),
      ...Object.keys(dateMaps.anrs),
    ]),
  ).sort();

  function buildSeries(id: string, map: Record<string, number>) {
    return {
      id,
      data: allDates.map((date, idx) => ({
        id: id + "." + idx,
        x: date,
        y: map[date] || 0,
      })),
    };
  }

  const result = [
    buildSeries("Sessions", dateMaps.sessions),
    buildSeries("Crashes", dateMaps.crashes),
    buildSeries("ANRs", dateMaps.anrs),
  ];

  // If all the series are empty, there is nothing to plot.
  if (result.every((series) => series.data.every((point) => point.y === 0))) {
    return null;
  }

  // Remove ANRs if all y values are 0
  const filteredResult = result.filter((series) => {
    if (series.id === "ANRs") {
      return series.data.some((point) => point.y !== 0);
    }
    return true;
  });

  return filteredResult;
};

export const fetchJourneyFromServer = async (
  bidirectional: boolean,
  filters: Filters,
) => {
  let url = `/api/apps/${filters.app!.id}/journey?`;

  // Append bidirectional value
  url = url + `bigraph=${bidirectional ? "1&" : "0&"}`;

  url = await applyGenericFiltersToUrl(url, filters, null, null);

  const data = await request(url, { failsWith: "Failed to fetch journey" });

  return data;
};

export const fetchMetricsFromServer = async (filters: Filters) => {
  let url = `/api/apps/${filters.app!.id}/metrics?`;

  url = await applyGenericFiltersToUrl(url, filters, null, null);

  const data = await request(url, { failsWith: "Failed to fetch metrics" });

  return data;
};

export const fetchSessionReplayOverviewFromServer = async (
  filters: Filters,
  limit: number,
  offset: number,
) => {
  var url = `/api/apps/${filters.app!.id}/sessions?`;

  url = await applyGenericFiltersToUrl(url, filters, limit, offset);
  url = appendSessionTypesToUrl(url, filters);

  const data = await request(url, {
    failsWith: "Failed to fetch session replay overview",
  });

  return data;
};

export const fetchSessionReplayOverviewPlotFromServer = async (
  filters: Filters,
) => {
  var url = `/api/apps/${filters.app!.id}/sessions/plots/instances?`;

  url = await applyGenericFiltersToUrl(url, filters, null, null);
  url = appendSessionTypesToUrl(url, filters);
  url = appendPlotTimeGroupToUrl(url, filters);

  const data = await request(url, {
    failsWith: "Failed to fetch session replay overview plot",
  });

  return data;
};

function appendErrorFiltersToUrl(url: string, filters: Filters): string {
  const u = new URL(url, window.location.origin);
  if (filters.selectedErrorTypes.length > 0) {
    u.searchParams.append("type", filters.selectedErrorTypes.join(","));
  }
  if (filters.selectedSeverities.length > 0) {
    u.searchParams.append("severity", filters.selectedSeverities.join(","));
  }
  if (filters.customErrorsOnly) {
    u.searchParams.append("custom", "true");
  }
  return u.toString();
}

export const fetchErrorsOverviewFromServer = async (
  filters: Filters,
  limit: number,
  offset: number,
) => {
  var url = `/api/apps/${filters.app!.id}/errorGroups?`;

  url = await applyGenericFiltersToUrl(url, filters, limit, offset);
  url = appendErrorFiltersToUrl(url, filters);

  const data = await request(url, {
    failsWith: "Failed to fetch errors overview",
  });

  return data;
};

export const fetchErrorsOverviewPlotFromServer = async (filters: Filters) => {
  var url = `/api/apps/${filters.app!.id}/errorGroups/plots/instances?`;

  url = await applyGenericFiltersToUrl(url, filters, null, null);
  url = appendPlotTimeGroupToUrl(url, filters);
  url = appendErrorFiltersToUrl(url, filters);

  const data = await request(url, {
    failsWith: "Failed to fetch errors overview plot",
  });

  return data;
};

export const fetchErrorsDetailsFromServer = async (
  errorGroupId: string,
  paginationOffset: number,
  filters: Filters,
  limit: number = 1,
) => {
  var url = `/api/apps/${filters.app!.id}/errorGroups/${errorGroupId}/errors?`;

  url = await applyGenericFiltersToUrl(url, filters, limit, paginationOffset);

  const data = await request(url, {
    failsWith: "Failed to fetch errors details",
  });

  return data;
};

export const fetchErrorGroupCommonPathFromServer = async (
  errorGroupId: string,
  filters: Filters,
) => {
  const url = `/api/apps/${filters.app!.id}/errorGroups/${errorGroupId}/path`;

  const data = await request(url, {
    failsWith: "Failed to fetch error group common path",
  });

  return data;
};

export const fetchErrorsDetailsPlotFromServer = async (
  errorGroupId: string,
  filters: Filters,
) => {
  var url = `/api/apps/${filters.app!.id}/errorGroups/${errorGroupId}/plots/instances?`;

  url = await applyGenericFiltersToUrl(url, filters, null, null);
  url = appendPlotTimeGroupToUrl(url, filters);

  const data = await request(url, {
    failsWith: "Failed to fetch errors details plot",
  });

  return data;
};

export const fetchErrorsDistributionPlotFromServer = async (
  errorGroupId: string,
  filters: Filters,
) => {
  var url = `/api/apps/${filters.app!.id}/errorGroups/${errorGroupId}/plots/distribution?`;

  url = await applyGenericFiltersToUrl(url, filters, null, null);

  const data = await request(url, {
    failsWith: "Failed to fetch errors distribution plot",
  });

  if (
    data === null ||
    Object.values(data).every(
      (value) =>
        typeof value === "object" &&
        value !== null &&
        Object.keys(value).length === 0,
    )
  ) {
    return null;
  }

  return data;
};

export const fetchAuthzAndMembersFromServer = async (teamId: string) => {
  const data = await request(`/api/teams/${teamId}/authz`, {
    failsWith: "Failed to fetch authz and members",
  });

  return data;
};

export const fetchSessionReplayFromServer = async (
  appId: string,
  sessionId: string,
) => {
  const data = await request(`/api/apps/${appId}/sessions/${sessionId}`, {
    failsWith: "Failed to fetch session replay",
  });

  return data;
};

export const changeTeamNameFromServer = async (
  teamId: string,
  newTeamName: string,
) => {
  await request(`/api/teams/${teamId}/rename`, {
    method: "PATCH",
    body: JSON.stringify({ name: newTeamName }),
    failsWith: "Failed to change team name",
    parseBody: false,
  });

  return;
};

export const createTeamFromServer = async (teamName: string) => {
  const data = await request(`/api/teams`, {
    method: "POST",
    body: JSON.stringify({ name: teamName }),
    failsWith: "Failed to create team",
  });

  return data;
};

export const createAppFromServer = async (teamId: string, appName: string) => {
  const data = await request(`/api/teams/${teamId}/apps`, {
    method: "POST",
    body: JSON.stringify({ name: appName }),
    failsWith: "Failed to create app",
  });

  return data;
};

export const changeRoleFromServer = async (
  teamId: string,
  newRole: string,
  memberId: string,
) => {
  await request(`/api/teams/${teamId}/members/${memberId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role: newRole.toLocaleLowerCase() }),
    failsWith: "Failed to change role",
  });
};

export const fetchPendingInvitesFromServer = async (teamId: string) => {
  const data = await request(`/api/teams/${teamId}/invites`, {
    failsWith: "Failed to fetch pending invites",
  });

  return data;
};

export const resendPendingInviteFromServer = async (
  teamId: string,
  inviteId: string,
) => {
  await request(`/api/teams/${teamId}/invite/${inviteId}`, {
    method: "PATCH",
    failsWith: "Failed to resend pending invite",
  });
};

export const removePendingInviteFromServer = async (
  teamId: string,
  inviteId: string,
) => {
  await request(`/api/teams/${teamId}/invite/${inviteId}`, {
    method: "DELETE",
    failsWith: "Failed to remove pending invite",
  });
};

export const inviteMemberFromServer = async (
  teamId: string,
  email: string,
  role: string,
) => {
  const lowerCaseRole = role.toLocaleLowerCase();
  await request(`/api/teams/${teamId}/invite`, {
    method: "POST",
    headers: {
      "Content-Type": `application/json`,
    },
    body: JSON.stringify([{ email: email, role: lowerCaseRole }]),
    failsWith: "Failed to invite member",
  });
};

export const removeMemberFromServer = async (
  teamId: string,
  memberId: string,
) => {
  await request(`/api/teams/${teamId}/members/${memberId}`, {
    method: "DELETE",
    failsWith: "Failed to remove member",
  });
};

export const fetchTeamSlackConnectUrlFromServer = async (teamId: string) => {
  const data = await request(`/api/teams/${teamId}/slack/connect-url`, {
    failsWith: "Failed to fetch team Slack connect url",
  });

  return data;
};

export const fetchTeamSlackStatusFromServer = async (teamId: string) => {
  const data = await request(`/api/teams/${teamId}/slack`, {
    failsWith: "Failed to fetch team Slack status",
  });

  return data;
};

export const fetchAppThresholdPrefsFromServer = async (appId: string) => {
  const data = await request(`/api/apps/${appId}/thresholdPrefs`, {
    failsWith: "Failed to fetch app threshold prefs",
  });

  return data;
};

export const updateAppThresholdPrefsFromServer = async (
  appId: string,
  prefs: typeof defaultAppThresholdPrefs,
) => {
  await request(`/api/apps/${appId}/thresholdPrefs`, {
    method: "PATCH",
    body: JSON.stringify(prefs),
    failsWith: "Failed to update app threshold prefs",
  });
};

export const updateTeamSlackStatusFromServer = async (
  teamId: string,
  slackStatus: boolean,
) => {
  await request(`/api/teams/${teamId}/slack/status`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: slackStatus }),
    failsWith: "Failed to update team Slack status",
  });
};

export const removeTeamSlackFromServer = async (teamId: string) => {
  try {
    await request(`/api/teams/${teamId}/slack`, {
      method: "DELETE",
      failsWith: "Failed to remove team Slack",
    });
  } catch (e) {
    // A 404 shows that there is no integration to remove. The goal state is
    // already correct, so report success and not an error.
    if (e instanceof ApiError && e.status === 404) {
      return;
    }
    throw e;
  }
};

export const sendTestSlackAlertFromServer = async (teamId: string) => {
  await request(`/api/teams/${teamId}/slack/test`, {
    method: "POST",
    failsWith: "Failed to send test Slack alert",
  });
};

export const fetchNotifPrefsFromServer = async () => {
  const data = await request(`/api/prefs/notifPrefs`, {
    failsWith: "Failed to fetch notif prefs",
  });

  return data;
};

export const updateNotifPrefsFromServer = async (
  notifPrefs: typeof emptyNotifPrefs,
) => {
  await request(`/api/prefs/notifPrefs`, {
    method: "PATCH",
    body: JSON.stringify(notifPrefs),
    failsWith: "Failed to update notif prefs",
  });
};

export const fetchAppRetentionFromServer = async (appId: string) => {
  const data = await request(`/api/apps/${appId}/retention`, {
    failsWith: "Failed to fetch app retention",
  });

  return data;
};

export const updateAppRetentionFromServer = async (
  appdId: string,
  appRetention: typeof emptyAppRetention,
) => {
  await request(`/api/apps/${appdId}/retention`, {
    method: "PATCH",
    body: JSON.stringify(appRetention),
    failsWith: "Failed to update app retention",
  });
};

export const changeAppNameFromServer = async (
  appId: string,
  newAppName: string,
) => {
  await request(`/api/apps/${appId}/rename`, {
    method: "PATCH",
    body: JSON.stringify({ name: newAppName }),
    failsWith: "Failed to change app name",
    parseBody: false,
  });

  return;
};

export const changeAppApiKeyFromServer = async (appId: string) => {
  await request(`/api/apps/${appId}/apiKey`, {
    method: "PATCH",
    failsWith: "Failed to change app api key",
    parseBody: false,
  });

  return;
};

export const fetchBillingInfoFromServer = async (teamId: string) => {
  const data = await request(`/api/teams/${teamId}/billing/info`, {
    failsWith: "Failed to fetch billing info",
  });

  return data;
};

export const fetchUsageFromServer = async (teamId: string) => {
  try {
    return await request(`/api/teams/${teamId}/usage`, {
      failsWith: "Failed to fetch usage",
    });
  } catch (e) {
    // A team with no apps has no usage to report, and answers with a 404.
    if (e instanceof ApiError && e.status === 404) {
      return null;
    }
    throw e;
  }
};

export const fetchCheckoutSessionFromServer = async (
  teamId: string,
  successUrl: string,
) => {
  const data = await request(`/api/teams/${teamId}/billing/checkout`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      success_url: successUrl,
    }),
    failsWith: "Failed to fetch checkout session",
  });

  return data;
};

export const downgradeToFreeFromServer = async (teamId: string) => {
  const data = await request(`/api/teams/${teamId}/billing/downgrade`, {
    method: "PATCH",
    failsWith: "Failed to downgrade to free",
  });

  return data;
};

export const undoDowngradeFromServer = async (teamId: string) => {
  const data = await request(`/api/teams/${teamId}/billing/undo-downgrade`, {
    method: "PATCH",
    failsWith: "Failed to undo downgrade",
  });

  return data;
};

export const fetchCustomerPortalUrlFromServer = async (
  teamId: string,
  returnUrl: string,
) => {
  const data = await request(`/api/teams/${teamId}/billing/portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      return_url: returnUrl,
    }),
    failsWith: "Failed to fetch customer portal url",
  });

  return data;
};

export const fetchBugReportsOverviewFromServer = async (
  filters: Filters,
  limit: number,
  offset: number,
) => {
  var url = `/api/apps/${filters.app!.id}/bugReports?`;

  url = await applyGenericFiltersToUrl(url, filters, limit, offset);
  url = appendBugReportStatusesToUrl(url, filters);

  const data = await request(url, {
    failsWith: "Failed to fetch bug reports overview",
  });

  return data;
};

export const fetchBugReportsOverviewPlotFromServer = async (
  filters: Filters,
) => {
  var url = `/api/apps/${filters.app!.id}/bugReports/plots/instances?`;

  url = await applyGenericFiltersToUrl(url, filters, null, null);
  url = appendBugReportStatusesToUrl(url, filters);
  url = appendPlotTimeGroupToUrl(url, filters);

  const data = await request(url, {
    failsWith: "Failed to fetch bug reports overview plot",
  });

  return data;
};

export const fetchBugReportFromServer = async (
  appId: string,
  bugReportId: string,
) => {
  const data = await request(`/api/apps/${appId}/bugReports/${bugReportId}`, {
    failsWith: "Failed to fetch bug report",
  });

  return data;
};

export const updateBugReportStatusFromServer = async (
  appId: string,
  bugReportId: string,
  status: number,
) => {
  await request(`/api/apps/${appId}/bugReports/${bugReportId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: Number(status) }),
    failsWith: "Failed to update bug report status",
  });
};

// downloadBuildFile triggers a build mapping file download. The download is
// a browser navigation, which bypasses apiClient's 401 refresh
// interceptor, so an authenticated endpoint is touched through apiClient
// first: an expired access token gets refreshed before the navigation
// instead of failing it.
export const downloadBuildFile = async (downloadUrl: string) => {
  try {
    const res = await apiClient.fetch(`/api/auth/session`);
    if (!res.ok) {
      // A non-ok probe means the refresh failed too: the session is dead
      // and apiClient has already started the redirect to login. A hard
      // navigation now would override that redirect and land the browser
      // on the api's raw 401 body instead of the login page.
      return;
    }
  } catch {
    // A thrown probe is a network failure, not an auth failure. The
    // session state is unknown rather than known-dead, so attempt the
    // navigation anyway; the worst case is a failed download the user
    // can retry.
  }

  navigateTo(downloadUrl);
};

export const fetchBuildsFromServer = async (
  filters: Filters,
  limit: number,
  offset: number,
) => {
  var url = `/api/apps/${filters.app!.id}/builds?`;

  url = await applyGenericFiltersToUrl(url, filters, limit, offset);

  const data = await request(url, { failsWith: "Failed to fetch builds" });

  return data;
};

export const fetchAlertsOverviewFromServer = async (
  filters: Filters,
  limit: number,
  offset: number,
) => {
  var url = `/api/apps/${filters.app!.id}/alerts?`;

  url = await applyGenericFiltersToUrl(url, filters, limit, offset);

  const data = await request(url, {
    failsWith: "Failed to fetch alerts overview",
  });

  return data;
};

export const fetchSdkConfigFromServer = async (appId: String) => {
  const url = `/api/apps/${appId}/config`;

  const data = await request(url, { failsWith: "Failed to fetch sdk config" });

  return data;
};

export const updateSdkConfigFromServer = async (
  appId: string,
  config: Partial<SdkConfig>,
) => {
  const url = `/api/apps/${appId}/config`;

  const data = await request(url, {
    method: "PATCH",
    body: JSON.stringify(config),
    failsWith: "Failed to update sdk config",
  });

  return data;
};

export const fetchNetworkDomainsFromServer = async (
  selectedApp: App,
  filters: Filters,
) => {
  const failsWith = "Failed to fetch network domains";

  // An unparsable date throws before the code builds the request. The caller
  // must get the same kind of error as it gets for a dropped connection.
  let url: string;
  try {
    url = `/api/apps/${selectedApp.id}/networkRequests/domains?from=${formatUserInputDateToServerFormat(filters.startDate)}&to=${formatUserInputDateToServerFormat(filters.endDate)}`;
  } catch (e) {
    throw new RequestError(failsWith, { cause: e });
  }

  const data = await request(url, { failsWith });

  if (data === null) {
    throw new RequestError(failsWith);
  }
  if (data.results === null || data.results.length === 0) {
    return null;
  }

  return data;
};

export const fetchNetworkPathsFromServer = async (
  selectedApp: App,
  domain: string,
  search: string,
  filters: Filters,
) => {
  const failsWith = "Failed to fetch network paths";

  // An unparsable date throws before the code builds the request. The caller
  // must get the same kind of error as it gets for a dropped connection.
  let url: string;
  try {
    const from = encodeURIComponent(
      formatUserInputDateToServerFormat(filters.startDate),
    );
    const to = encodeURIComponent(
      formatUserInputDateToServerFormat(filters.endDate),
    );
    url = `/api/apps/${selectedApp.id}/networkRequests/paths?domain=${encodeURIComponent(domain)}&search=${encodeURIComponent(search)}&from=${from}&to=${to}`;
  } catch (e) {
    throw new RequestError(failsWith, { cause: e });
  }

  const data = await request(url, { failsWith });

  if (data === null) {
    throw new RequestError(failsWith);
  }
  if (data.results === null || data.results.length === 0) {
    return null;
  }

  return data;
};

export const fetchNetworkEndpointLatencyPlotFromServer = async (
  filters: Filters,
  domain: string,
  path: string,
) => {
  var apiUrl = `/api/apps/${filters.app!.id}/networkRequests/plots/endpointLatency?`;

  apiUrl = await applyGenericFiltersToUrl(apiUrl, filters, null, null);
  apiUrl = appendPlotTimeGroupToUrl(apiUrl, filters);
  apiUrl = appendHttpMethodsToUrl(apiUrl, filters);

  const u = new URL(apiUrl, window.location.origin);
  u.searchParams.append("domain", domain);
  u.searchParams.append("path", path);
  apiUrl = u.toString();

  const data = await request(apiUrl, {
    failsWith: "Failed to fetch network endpoint latency plot",
  });

  return data;
};

export const fetchNetworkEndpointStatusCodesPlotFromServer = async (
  filters: Filters,
  domain: string,
  path: string,
) => {
  var apiUrl = `/api/apps/${filters.app!.id}/networkRequests/plots/endpointStatusCodes?`;

  apiUrl = await applyGenericFiltersToUrl(apiUrl, filters, null, null);
  apiUrl = appendPlotTimeGroupToUrl(apiUrl, filters);
  apiUrl = appendHttpMethodsToUrl(apiUrl, filters);

  const u = new URL(apiUrl, window.location.origin);
  u.searchParams.append("domain", domain);
  u.searchParams.append("path", path);
  apiUrl = u.toString();

  const data = await request(apiUrl, {
    failsWith: "Failed to fetch network endpoint status codes plot",
  });

  return data;
};

export const fetchNetworkEndpointTimelinePlotFromServer = async (
  filters: Filters,
  domain: string,
  path: string,
) => {
  var apiUrl = `/api/apps/${filters.app!.id}/networkRequests/plots/endpointTimeline?`;

  apiUrl = await applyGenericFiltersToUrl(apiUrl, filters, null, null);
  apiUrl = appendHttpMethodsToUrl(apiUrl, filters);

  const u = new URL(apiUrl, window.location.origin);
  u.searchParams.append("domain", domain);
  u.searchParams.append("path", path);
  apiUrl = u.toString();

  const data = await request(apiUrl, {
    failsWith: "Failed to fetch network endpoint timeline plot",
  });

  if (data === null || !data.points || data.points.length === 0) {
    return null;
  }

  return data;
};

export const fetchNetworkTrendsFromServer = async (
  filters: Filters,
  trendsLimit: number = 10,
) => {
  var apiUrl = `/api/apps/${filters.app!.id}/networkRequests/trends?`;

  apiUrl = await applyGenericFiltersToUrl(apiUrl, filters, null, null);
  apiUrl += `&trends_limit=${trendsLimit}`;

  const data = await request(apiUrl, {
    failsWith: "Failed to fetch network trends",
  });

  return data;
};

export const fetchNetworkTimelinePlotFromServer = async (
  filters: Filters,
  timelineLimit: number,
) => {
  var apiUrl = `/api/apps/${filters.app!.id}/networkRequests/plots/overviewTimeline?`;

  apiUrl = await applyGenericFiltersToUrl(apiUrl, filters, null, null);
  apiUrl += `&timeline_limit=${timelineLimit}`;

  const data = await request(apiUrl, {
    failsWith: "Failed to fetch network timeline plot",
  });

  if (data === null || !data.points || data.points.length === 0) {
    return null;
  }

  return data;
};

export const fetchNetworkOverviewStatusCodesPlotFromServer = async (
  filters: Filters,
) => {
  var apiUrl = `/api/apps/${filters.app!.id}/networkRequests/plots/overviewStatusCodes?`;

  apiUrl = await applyGenericFiltersToUrl(apiUrl, filters, null, null);
  apiUrl = appendPlotTimeGroupToUrl(apiUrl, filters);

  const data = await request(apiUrl, {
    failsWith: "Failed to fetch network overview status codes plot",
  });

  if (data === null || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  return data;
};
