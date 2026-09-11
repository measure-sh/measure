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
import type { FilterKeysResponse, FilterValue } from "./filter_types";

export enum JourneyType {
  Paths,
  Exceptions,
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
    no_data: false,
  },
  anr_free_sessions: {
    anr_free_sessions: 0,
    unselected_anr_free_sessions: 0,
    no_data: false,
    unselected_no_data: false,
  },
  cold_launch: {
    p95: 0,
    unselected_p95: 0,
    no_data: false,
    unselected_no_data: false,
  },
  crash_free_sessions: {
    crash_free_sessions: 0,
    unselected_crash_free_sessions: 0,
    no_data: false,
    unselected_no_data: false,
  },
  hot_launch: {
    p95: 0,
    unselected_p95: 0,
    no_data: false,
    unselected_no_data: false,
  },
  perceived_anr_free_sessions: {
    perceived_anr_free_sessions: 0,
    unselected_perceived_anr_free_sessions: 0,
    no_data: false,
    unselected_no_data: false,
  },
  perceived_crash_free_sessions: {
    perceived_crash_free_sessions: 0,
    unselected_perceived_crash_free_sessions: 0,
    no_data: false,
    unselected_no_data: false,
  },
  sizes: {
    average_app_size: 0,
    selected_app_size: 0,
    delta: 0,
    no_data: false,
  },
  warm_launch: {
    p95: 0,
    unselected_p95: 0,
    no_data: false,
    unselected_no_data: false,
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
    patch_version?: string;
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

export type Build = (typeof emptyBuildsResponse)["results"][number];
export type BuildFile = Build["files"][number];

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
  error_replay_duration: number;
  error_fatal_take_screenshot: boolean;
  error_fatal_replay_enabled: boolean;
  error_unhandled_replay_enabled: boolean;
  error_handled_replay_enabled: boolean;
  error_fatal_sampling_rate: number;
  error_unhandled_sampling_rate: number;
  error_handled_sampling_rate: number;
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
    throw new ApiError(
      res.status,
      body?.error ?? failsWith,
      body?.filter_expr_issues,
    );
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

export const fetchTraceFromServer = async (appId: string, traceId: string) => {
  const data = await request(`/api/apps/${appId}/traces/${traceId}`, {
    failsWith: "Failed to fetch trace",
  });

  return data;
};

export const fetchAppHealthPlotFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
) => {
  const params = new URLSearchParams({
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
    plot_time_group: getPlotTimeGroupForRange(startDate, endDate),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }

  const data = await request(
    `/api/apps/${appId}/health/plots/instances?${params.toString()}`,
    { failsWith: "Failed to fetch app health plot" },
  );

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
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
) => {
  const params = new URLSearchParams({
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }

  return await request(`/api/apps/${appId}/journey?${params.toString()}`, {
    failsWith: "Failed to fetch journey",
  });
};

export const fetchMetricsFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
) => {
  const params = new URLSearchParams({
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }

  return await request(`/api/apps/${appId}/metrics?${params.toString()}`, {
    failsWith: "Failed to fetch metrics",
  });
};

export const fetchSessionReplayOverviewFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
  limit: number,
  offset: number,
) => {
  const params = new URLSearchParams({
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
    limit: String(limit),
    offset: String(offset),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }

  return await request(`/api/apps/${appId}/sessions?${params.toString()}`, {
    failsWith: "Failed to fetch session replay overview",
  });
};

export const fetchSessionReplayOverviewPlotFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
) => {
  const params = new URLSearchParams({
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
    plot_time_group: getPlotTimeGroupForRange(startDate, endDate),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }

  return await request(
    `/api/apps/${appId}/sessions/plots/instances?${params.toString()}`,
    { failsWith: "Failed to fetch session replay overview plot" },
  );
};

export const fetchErrorsOverviewFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
  limit: number,
  offset: number,
) => {
  const params = new URLSearchParams({
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
    limit: String(limit),
    offset: String(offset),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }

  return await request(`/api/apps/${appId}/errorGroups?${params.toString()}`, {
    failsWith: "Failed to fetch errors overview",
  });
};

export const fetchErrorsOverviewPlotFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
) => {
  const params = new URLSearchParams({
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
    plot_time_group: getPlotTimeGroupForRange(startDate, endDate),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }

  return await request(
    `/api/apps/${appId}/errorGroups/plots/instances?${params.toString()}`,
    { failsWith: "Failed to fetch errors overview plot" },
  );
};

export const fetchErrorsDetailsFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
  errorGroupId: string,
  limit: number,
  offset: number,
) => {
  const params = new URLSearchParams({
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
    limit: String(limit),
    offset: String(offset),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }

  return await request(
    `/api/apps/${appId}/errorGroups/${errorGroupId}/errors?${params.toString()}`,
    { failsWith: "Failed to fetch errors details" },
  );
};

export const fetchErrorGroupCommonPathFromServer = async (
  appId: string,
  errorGroupId: string,
) => {
  return await request(`/api/apps/${appId}/errorGroups/${errorGroupId}/path`, {
    failsWith: "Failed to fetch error group common path",
  });
};

export const fetchErrorsDetailsPlotFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
  errorGroupId: string,
) => {
  const params = new URLSearchParams({
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
    plot_time_group: getPlotTimeGroupForRange(startDate, endDate),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }

  return await request(
    `/api/apps/${appId}/errorGroups/${errorGroupId}/plots/instances?${params.toString()}`,
    { failsWith: "Failed to fetch errors details plot" },
  );
};

export const fetchErrorsDistributionPlotFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
  errorGroupId: string,
) => {
  const params = new URLSearchParams({
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }

  const data = await request(
    `/api/apps/${appId}/errorGroups/${errorGroupId}/plots/distribution?${params.toString()}`,
    { failsWith: "Failed to fetch errors distribution plot" },
  );

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
  const trimmedEmail = email.trim();
  await request(`/api/teams/${teamId}/invite`, {
    method: "POST",
    headers: {
      "Content-Type": `application/json`,
    },
    body: JSON.stringify([{ email: trimmedEmail, role: lowerCaseRole }]),
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
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
  limit: number,
  offset: number,
) => {
  const params = new URLSearchParams({
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
    limit: String(limit),
    offset: String(offset),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }

  return await request(`/api/apps/${appId}/bugReports?${params.toString()}`, {
    failsWith: "Failed to fetch bug reports overview",
  });
};

export const fetchBugReportsOverviewPlotFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
) => {
  const params = new URLSearchParams({
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
    plot_time_group: getPlotTimeGroupForRange(startDate, endDate),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }

  return await request(
    `/api/apps/${appId}/bugReports/plots/instances?${params.toString()}`,
    { failsWith: "Failed to fetch bug reports overview plot" },
  );
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

// ─── Dynamic filters ─────────────────────────────────────────────────────

export const fetchFilterKeys = async (
  appId: string,
  entity: string,
  keyNames: string[],
): Promise<FilterKeysResponse> => {
  // Keys the caller specifies are resolved even when the app has more custom
  // keys than the listing returns.
  const keyParams = keyNames
    .map((name) => `&key=${encodeURIComponent(name)}`)
    .join("");
  const data = await request(
    `/api/apps/${appId}/filters/keys?entity=${encodeURIComponent(entity)}${keyParams}`,
    { failsWith: "Failed to fetch filter keys" },
  );

  return { keys: data.keys ?? [], key_groups: data.key_groups ?? [] };
};

export const fetchFilterValues = async (
  appId: string,
  entity: string,
  keyName: string,
  search: string,
): Promise<{ values: FilterValue[]; truncated: boolean }> => {
  const params = new URLSearchParams({
    entity: entity,
    key_name: keyName,
  });
  if (search !== "") {
    params.set("search", search);
  }

  const data = await request(
    `/api/apps/${appId}/filters/values?${params.toString()}`,
    { failsWith: "Failed to fetch filter values" },
  );

  return { values: data.values ?? [], truncated: data.truncated ?? false };
};

export const fetchBuildsFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
  limit: number,
  offset: number,
) => {
  const params = new URLSearchParams({
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
    limit: String(limit),
    offset: String(offset),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }

  return await request(`/api/apps/${appId}/builds?${params.toString()}`, {
    failsWith: "Failed to fetch builds",
  });
};

export const fetchSpansFromServer = async (
  appId: string,
  spanName: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
  limit: number,
  offset: number,
) => {
  const params = new URLSearchParams({
    span_name: spanName,
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
    limit: String(limit),
    offset: String(offset),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }

  return await request(`/api/apps/${appId}/spans?${params.toString()}`, {
    failsWith: "Failed to fetch spans",
  });
};

export const fetchSpanMetricsPlotFromServer = async (
  appId: string,
  spanName: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
) => {
  const params = new URLSearchParams({
    span_name: spanName,
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
    plot_time_group: getPlotTimeGroupForRange(startDate, endDate),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }

  return await request(
    `/api/apps/${appId}/spans/plots/metrics?${params.toString()}`,
    { failsWith: "Failed to fetch span metrics plot" },
  );
};

export const fetchAlertsOverviewFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  limit: number,
  offset: number,
) => {
  const params = new URLSearchParams({
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
    limit: String(limit),
    offset: String(offset),
  });

  return await request(`/api/apps/${appId}/alerts?${params.toString()}`, {
    failsWith: "Failed to fetch alerts overview",
  });
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

export type NetworkEndpoint = { domain: string; path_pattern: string };

function networkRequestParams(
  startDate: string,
  endDate: string,
  filterExpr: string | null,
): URLSearchParams {
  const params = new URLSearchParams({
    from: formatUserInputDateToServerFormat(startDate),
    to: formatUserInputDateToServerFormat(endDate),
    timezone: getTimeZoneForServer(),
  });
  if (filterExpr) {
    params.set("filter_expr", filterExpr);
  }
  return params;
}

// An empty domain or path is sent as is and means every domain or path.
function networkPlotParams(
  startDate: string,
  endDate: string,
  filterExpr: string | null,
  domain: string,
  path: string,
): URLSearchParams {
  const params = networkRequestParams(startDate, endDate, filterExpr);
  params.set("domain", domain);
  params.set("path", path);
  return params;
}

export const fetchNetworkEndpointsFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
  query: string,
  signal?: AbortSignal,
): Promise<NetworkEndpoint[]> => {
  const params = networkRequestParams(startDate, endDate, filterExpr);
  if (query !== "") {
    params.set("query", query);
  }

  const data = await request(
    `/api/apps/${appId}/networkRequests/endpoints?${params.toString()}`,
    { failsWith: "Failed to fetch network endpoints", signal },
  );

  return (data?.results as NetworkEndpoint[] | null) ?? [];
};

export const fetchNetworkLatencyPlotFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
  domain: string,
  path: string,
) => {
  const params = networkPlotParams(
    startDate,
    endDate,
    filterExpr,
    domain,
    path,
  );
  params.set("plot_time_group", getPlotTimeGroupForRange(startDate, endDate));

  const data = await request(
    `/api/apps/${appId}/networkRequests/plots/latency?${params.toString()}`,
    { failsWith: "Failed to fetch network latency plot" },
  );

  return data === null || (Array.isArray(data) && data.length === 0)
    ? null
    : data;
};

export const fetchNetworkStatusCodesPlotFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
  domain: string,
  path: string,
) => {
  const params = networkPlotParams(
    startDate,
    endDate,
    filterExpr,
    domain,
    path,
  );
  params.set("plot_time_group", getPlotTimeGroupForRange(startDate, endDate));

  const data = await request(
    `/api/apps/${appId}/networkRequests/plots/statusCodes?${params.toString()}`,
    { failsWith: "Failed to fetch network status codes plot" },
  );

  if (data === null || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  return data;
};

export const fetchNetworkEndpointStatusCodesPlotFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
  domain: string,
  path: string,
) => {
  const params = networkPlotParams(
    startDate,
    endDate,
    filterExpr,
    domain,
    path,
  );
  params.set("plot_time_group", getPlotTimeGroupForRange(startDate, endDate));

  const data = await request(
    `/api/apps/${appId}/networkRequests/plots/endpointStatusCodes?${params.toString()}`,
    { failsWith: "Failed to fetch network endpoint status codes plot" },
  );

  if (data === null || !data.data_points || data.data_points.length === 0) {
    return null;
  }

  return data;
};

export const fetchNetworkTimelinePlotFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
  domain: string,
  path: string,
) => {
  const params = networkPlotParams(
    startDate,
    endDate,
    filterExpr,
    domain,
    path,
  );

  const data = await request(
    `/api/apps/${appId}/networkRequests/plots/timeline?${params.toString()}`,
    { failsWith: "Failed to fetch network timeline plot" },
  );

  if (data === null || !data.points || data.points.length === 0) {
    return null;
  }

  return data;
};

export const fetchNetworkTrendsFromServer = async (
  appId: string,
  startDate: string,
  endDate: string,
  filterExpr: string | null,
  trendsLimit: number,
) => {
  const params = networkRequestParams(startDate, endDate, filterExpr);
  params.set("trends_limit", String(trendsLimit));

  return await request(
    `/api/apps/${appId}/networkRequests/trends?${params.toString()}`,
    { failsWith: "Failed to fetch network trends" },
  );
};
