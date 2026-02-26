import { measureAuth } from "../auth/measure_auth"
import { Filters } from "../components/filters"
import { JourneyType } from "../components/journey"
import {
  formatUserInputDateToServerFormat,
  getPlotTimeGroupForRange,
  getTimeZoneForServer,
} from "../utils/time_utils"

export enum ValidateInviteApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum TeamsApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum AppsApiStatus {
  Loading,
  Success,
  Error,
  NoApps,
  Cancelled,
}

export enum RootSpanNamesApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled,
}

export enum SpanMetricsPlotApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled,
}

export enum SpansApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum TraceApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum FiltersApiStatus {
  Loading,
  Success,
  Error,
  NotOnboarded,
  NoData,
  Cancelled,
}
export enum SaveFiltersApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum FilterSource {
  Events,
  Crashes,
  Anrs,
  Spans,
}

export enum SessionsVsExceptionsPlotApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled,
}

export enum JourneyApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled,
}

export enum MetricsApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum SessionTimelinesOverviewApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum ExceptionsType {
  Crash,
  Anr,
}

export enum ExceptionsOverviewApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum ExceptionsOverviewPlotApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled,
}

export enum SessionTimelinesOverviewPlotApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled,
}

export enum ExceptionsDetailsApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum ExceptionGroupCommonPathApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum ExceptionsDetailsPlotApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled,
}
export enum ExceptionsDistributionPlotApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled,
}

export enum CreateTeamApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum CreateAppApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum TeamNameChangeApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum AppNameChangeApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum AppApiKeyChangeApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum RoleChangeApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum PendingInvitesApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum ResendPendingInviteApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum RemovePendingInviteApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum InviteMemberApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum RemoveMemberApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum AuthzAndMembersApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum FetchTeamSlackConnectUrlApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum FetchTeamSlackStatusApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum UpdateTeamSlackStatusApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum FetchAppThresholdPrefsApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum UpdateAppThresholdPrefsApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum TestSlackAlertApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum SessionTimelineApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum FetchAlertPrefsApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum UpdateAlertPrefsApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum FetchAppRetentionApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum UpdateAppRetentionApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum FetchUsageApiStatus {
  Loading,
  Success,
  Error,
  NoApps,
  Cancelled,
}

export enum FetchStripeCheckoutSessionApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum DowngradeToFreeApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum FetchBillingInfoApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum FetchBillingUsageThresholdApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum FetchSubscriptionInfoApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum BugReportsOverviewApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum BugReportsOverviewPlotApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled,
}

export enum BugReportApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum UpdateBugReportStatusApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum AlertsOverviewApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum SdkConfigApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum UpdateSdkConfigApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum SessionType {
  Crashes = "Crash Sessions",
  ANRs = "ANR Sessions",
  BugReports = "Bug Report Sessions",
  UserInteraction = "User Interaction Sessions",
  Foreground = "Foreground Sessions",
  Background = "Background Sessions"
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

export type Team = {
  id: string
  name: string
}

export type PendingInvite = {
  id: string
  invited_by_user_id: string
  invited_by_email: string
  invited_to_team_id: string
  role: string
  email: string
  created_at: string
  updated_at: string
  valid_until: string
}

export type App = {
  id: string
  team_id: string
  name: string
  api_key: {
    created_at: string
    key: string
    last_seen: string | null
    revoked: boolean
  }
  onboarded: boolean
  created_at: string
  updated_at: string
  os_name: string | null
  onboarded_at: string | null
  unique_identifier: string | null
}

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
}

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
}

export const emptySessionTimelinesOverviewResponse = {
  meta: {
    next: false,
    previous: false,
  },
  results: [] as {
    session_id: string
    app_id: string
    first_event_time: string
    last_event_time: string
    duration: string
    matched_free_text: string
    attribute: {
      app_version: string
      app_build: string
      user_id: string
      device_name: string
      device_model: string
      device_manufacturer: string
      os_name: string
      os_version: string
    }
  }[],
}

export const emptySpansResponse = {
  meta: {
    next: false,
    previous: false,
  },
  results: [] as {
    app_id: string
    span_name: string
    span_id: string
    trace_id: string
    status: number
    start_time: string
    end_time: string
    duration: number
    app_version: string
    app_build: string
    os_name: string
    os_version: string
    device_manufacturer: string
    device_model: string
  }[],
}

const emptyExceptionGroup = {
  id: "",
  app_id: "",
  type: "",
  message: "",
  method_name: "",
  file_name: "",
  line_number: 0,
  count: 0,
  percentage_contribution: 0,
  updated_at: "",
}

export const emptyExceptionsOverviewResponse = {
  meta: {
    next: false,
    previous: false,
  },
  results: [] as (typeof emptyExceptionGroup)[],
}

const emptyCrashGroupDetails = {
  id: "",
  session_id: "",
  timestamp: "",
  type: "",
  thread_name: "",
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
    os_name: "",
    os_version: "",
    network_type: "",
    network_provider: "",
    network_generation: "",
  },
  exception: {
    title: "",
    stacktrace: "",
  },
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
  attributes: {},
}

export const emptyCrashExceptionsDetailsResponse = {
  meta: {
    next: true,
    previous: false,
  },
  results: [] as (typeof emptyCrashGroupDetails)[],
}

const emptyAnrGroupDetails = {
  id: "",
  session_id: "",
  timestamp: "",
  type: "",
  thread_name: "",
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
    os_name: "",
    os_version: "",
    network_type: "",
    network_provider: "",
    network_generation: "",
  },
  anr: {
    title: "",
    stacktrace: "",
  },
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
  attributes: {},
}

export const emptyAnrExceptionsDetailsResponse = {
  meta: {
    next: true,
    previous: false,
  },
  results: [] as (typeof emptyAnrGroupDetails)[],
}

export const defaultAuthzAndMembers = {
  can_invite_roles: ["viewer"],
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
}

export const defaultAppThresholdPrefs = {
  error_good_threshold: 95,
  error_caution_threshold: 85,
  error_spike_min_count_threshold: 100,
  error_spike_min_rate_threshold: 0.5,
}

export const emptySessionTimeline = {
  app_id: "2b7ddad4-40a6-42a7-9e21-a90577e08263",
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
    device_is_foldable: true,
    device_is_physical: false,
    device_density_dpi: 0,
    device_width_px: 0,
    device_height_px: 0,
    device_density: 0.0,
    device_locale: "",
    os_name: "",
    os_version: "",
    network_type: "",
    network_provider: "",
    network_generation: "",
  },
  cpu_usage: [
    {
      timestamp: "",
      value: 0.0,
    },
  ],
  duration: 0,
  memory_usage: [
    {
      java_max_heap: 0,
      java_total_heap: 0,
      java_free_heap: 0,
      total_pss: 0,
      rss: 0,
      native_total_heap: 0,
      native_free_heap: 0,
      interval: 0,
      timestamp: "",
    },
  ],
  memory_usage_absolute: [
    {
      max_memory: 0,
      used_memory: 0,
      interval: 0,
      timestamp: "",
    },
  ],
  session_id: "",
  threads: {
    main: [
      {
        event_type: "lifecycle_activity",
        thread_name: "",
        type: "",
        class_name: "",
        intent: "",
        saved_instance_state: false,
        timestamp: "",
      },
      {
        event_type: "lifecycle_app",
        thread_name: "",
        type: "",
        timestamp: "",
      },
      {
        event_type: "exception",
        type: "",
        message: "",
        method_name: "",
        file_name: "",
        line_number: 0,
        thread_name: "",
        handled: false,
        stacktrace: "",
        foreground: true,
        timestamp: "",
        attachments: [
          {
            id: "",
            name: "",
            type: "",
            key: "",
            location: "",
          },
        ],
      },
    ],
  },
  traces: [
    {
      trace_id: "847be6f84f004045d9deebea9b2fafe7",
      trace_name: "root",
      thread_name: "Thread-2",
      start_time: "2024-12-16T03:31:04.16Z",
      end_time: "2024-12-16T03:31:08.167Z",
      duration: 4007,
    },
    {
      trace_id: "3dd7bb2600064eea1a595021d77cb3d5",
      trace_name: "activity.onCreate",
      thread_name: "main",
      start_time: "2024-12-16T03:30:57.915Z",
      end_time: "2024-12-16T03:30:58.195Z",
      duration: 280,
    },
    {
      trace_id: "097d6c882be5f5ccacc0ef700b17b87a",
      trace_name: "SampleApp.onCreate",
      thread_name: "main",
      start_time: "2024-12-16T03:30:57.712Z",
      end_time: "2024-12-16T03:30:57.829Z",
      duration: 117,
    },
    {
      trace_id: "7e5ccd666dc26dbb65f4ce92b543637e",
      trace_name: "activity.onCreate",
      thread_name: "main",
      start_time: "2024-12-16T03:26:48.27Z",
      end_time: "2024-12-16T03:26:48.351Z",
      duration: 81,
    },
    {
      trace_id: "b0a9210cb6b5b98773e4ae6d98f65a8c",
      trace_name: "SampleApp.onCreate",
      thread_name: "main",
      start_time: "2024-12-16T03:26:48.18Z",
      end_time: "2024-12-16T03:26:48.232Z",
      duration: 52,
    },
  ],
}

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
}

export const emptyAlertPrefs = {
  crash_rate_spike: {
    email: true,
  },
  anr_rate_spike: {
    email: true,
  },
  launch_time_spike: {
    email: true,
  },
}

export const emptyAppRetention = {
  retention: 30,
}

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
      },
    ],
  },
]

export const emptyBugReportsOverviewResponse = {
  meta: {
    next: false,
    previous: false,
  },
  results: [] as {
    session_id: string
    app_id: string
    event_id: string
    status: number
    description: string
    timestamp: string
    attribute: {
      installation_id: string
      app_version: string
      app_build: string
      app_unique_id: string
      measure_sdk_version: string
      platform: string
      thread_name: string
      user_id: string
      device_name: string
      device_model: string
      device_manufacturer: string
      device_type: string
      device_is_foldable: boolean
      device_is_physical: boolean
      device_density_dpi: number
      device_width_px: number
      device_height_px: number
      device_density: number
      device_locale: string
      device_low_power_mode: boolean
      device_thermal_throttling_enabled: boolean
      device_cpu_arch: string
      os_name: string
      os_version: string
      os_page_size: number
      network_type: string
      network_provider: string
      network_generation: string
    }
    user_defined_attribute: null
    attachments: null
    matched_free_text: string
  }[],
}

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
}

export const emptyAlertsOverviewResponse = {
  meta: {
    next: false,
    previous: false,
  },
  results: [] as {
    id: string
    team_id: string
    app_id: string
    entity_id: string
    type: string
    message: string
    url: string
    created_at: string
    updated_at: string
  }[],
}

export type SdkConfig = {
  trace_sampling_rate: number
  crash_timeline_duration: number
  crash_take_screenshot: boolean
  anr_timeline_duration: number
  anr_take_screenshot: boolean
  bug_report_timeline_duration: number
  launch_sampling_rate: number
  journey_sampling_rate: number
  http_disable_event_for_urls: string[]
  http_track_request_for_urls: string[]
  http_track_response_for_urls: string[]
  http_blocked_headers: string[]
  screenshot_mask_level: string
}
export class AppVersion {
  name: string
  code: string
  displayName: string

  constructor(name: string, code: string) {
    this.name = name
    this.code = code
    this.displayName = this.name + " (" + this.code + ")"
  }
}

export class OsVersion {
  name: string
  version: string
  displayName: string

  constructor(name: string, version: string) {
    this.name = name
    this.version = version
    this.displayName = (name === 'android' ? 'Android API Level' : name === "ios" ? "iOS" : name === "ipados" ? "iPadOS" : name) + " " + this.version
  }
}

export type UserDefAttr = {
  key: string
  type: string
}

export const saveListFiltersToServer = async (filters: Filters) => {
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
    return null
  }

  let url = `/api/apps/${filters.app!.id}/shortFilters`

  const udExpression = {
    and: filters.udAttrMatchers.map((matcher) => ({
      cmp: {
        key: matcher.key,
        type: matcher.type,
        op: matcher.op,
        value: String(matcher.value),
      },
    })),
  }

  // we always include app versions regardless of whether all are selected for more efficient filtering on backend
  const bodyFilters: any = {
    versions: filters.versions.selected.map((v) => v.name),
    version_codes: filters.versions.selected.map((v) => v.code),
    os_names: filters.osVersions.all ? [] : filters.osVersions.selected.map((v) => v.name),
    os_versions: filters.osVersions.all ? [] : filters.osVersions.selected.map((v) => v.version),
    countries: filters.countries.all ? [] : filters.countries.selected,
    network_providers: filters.networkProviders.all ? [] : filters.networkProviders.selected,
    network_types: filters.networkTypes.all ? [] : filters.networkTypes.selected,
    network_generations: filters.networkGenerations.all ? [] : filters.networkGenerations.selected,
    locales: filters.locales.all ? [] : filters.locales.selected,
    device_manufacturers: filters.deviceManufacturers.all ? [] : filters.deviceManufacturers.selected,
    device_names: filters.deviceNames.all ? [] : filters.deviceNames.selected,
  }

  if (filters.udAttrMatchers.length > 0) {
    bodyFilters.ud_expression = JSON.stringify(udExpression)
  }

  const opts = {
    method: "POST",
    body: JSON.stringify({
      filters: bodyFilters,
    }),
  }

  try {
    const res = await measureAuth.fetchMeasure(url, opts)

    if (!res.ok) {
      return null
    }

    const data = await res.json()
    return data.filter_short_code
  } catch {
    return null
  }
}

async function applyGenericFiltersToUrl(
  url: string,
  filters: Filters,
  limit: number | null,
  offset: number | null,
) {
  const serverFormattedStartDate = formatUserInputDateToServerFormat(
    filters.startDate,
  )
  const serverFormattedEndDate = formatUserInputDateToServerFormat(
    filters.endDate,
  )
  const timezone = getTimeZoneForServer()

  const u = new URL(url, window.location.origin)
  const searchParams = new URLSearchParams()

  searchParams.append("from", serverFormattedStartDate)
  searchParams.append("to", serverFormattedEndDate)
  searchParams.append("timezone", timezone)

  const filterShortCode = await saveListFiltersToServer(filters)

  if (filterShortCode !== null) {
    searchParams.append("filter_short_code", filterShortCode)
  }

  // Append free text if present
  if (filters.freeText !== "") {
    searchParams.append("free_text", filters.freeText)
  }

  // Append limit if present
  if (limit !== null) {
    searchParams.append("limit", String(limit))
  }

  // Append offset if present
  if (offset !== null) {
    searchParams.append("offset", String(offset))
  }

  u.search = searchParams.toString()

  return u.toString()
}

function appendPlotTimeGroupToUrl(url: string, filters: Filters): string {
  const u = new URL(url, window.location.origin)
  u.searchParams.set("plot_time_group", getPlotTimeGroupForRange(filters.startDate, filters.endDate))
  return u.toString()
}

function appendSessionTypesToUrl(url: string, filters: Filters): string {
  const u = new URL(url, window.location.origin)
  if (!filters.sessionTypes.all && filters.sessionTypes.selected.length > 0) {
    filters.sessionTypes.selected.forEach((v) => {
      switch (v) {
        case SessionType.Crashes:
          u.searchParams.append("crash", "1")
          break
        case SessionType.ANRs:
          u.searchParams.append("anr", "1")
          break
        case SessionType.BugReports:
          u.searchParams.append("bug_report", "1")
          break
        case SessionType.UserInteraction:
          u.searchParams.append("user_interaction", "1")
          break
        case SessionType.Foreground:
          u.searchParams.append("foreground", "1")
          break
        case SessionType.Background:
          u.searchParams.append("background", "1")
          break
      }
    })
  }
  return u.toString()
}

function appendSpanFiltersToUrl(url: string, filters: Filters): string {
  const u = new URL(url, window.location.origin)
  if (filters.rootSpanName !== "") {
    u.searchParams.append("span_name", encodeURIComponent(filters.rootSpanName))
  }
  if (!filters.spanStatuses.all && filters.spanStatuses.selected.length > 0) {
    filters.spanStatuses.selected.forEach((v) => {
      if (v === SpanStatus.Unset) {
        u.searchParams.append("span_statuses", "0")
      } else if (v === SpanStatus.Ok) {
        u.searchParams.append("span_statuses", "1")
      } else if (v === SpanStatus.Error) {
        u.searchParams.append("span_statuses", "2")
      }
    })
  }
  return u.toString()
}

function appendBugReportStatusesToUrl(url: string, filters: Filters): string {
  const u = new URL(url, window.location.origin)
  if (!filters.bugReportStatuses.all && filters.bugReportStatuses.selected.length > 0) {
    filters.bugReportStatuses.selected.forEach((v) => {
      if (v === BugReportStatus.Open) {
        u.searchParams.append("bug_report_statuses", "0")
      } else if (v === BugReportStatus.Closed) {
        u.searchParams.append("bug_report_statuses", "1")
      }
    })
  }
  return u.toString()
}

export const validateInvitesFromServer = async (inviteId: string) => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/auth/validateInvite`, {
      method: "POST",
      body: JSON.stringify({ invite_id: inviteId }),
    })

    if (!res.ok) {
      console.log("Validate invite failed with status:", res.status)
      return { status: ValidateInviteApiStatus.Error }
    }

    console.log("Validate invite succeeded")
    return { status: ValidateInviteApiStatus.Success }
  } catch {
    console.log("Validate invite cancelled due to exception")
    return { status: ValidateInviteApiStatus.Cancelled }
  }
}

export const fetchTeamsFromServer = async () => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/teams`)

    if (!res.ok) {
      return { status: TeamsApiStatus.Error, data: null }
    }

    const data: [{ id: string; name: string }] = await res.json()

    return { status: TeamsApiStatus.Success, data: data }
  } catch {
    return { status: TeamsApiStatus.Cancelled, data: null }
  }
}

export const fetchAppsFromServer = async (teamId: string) => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/teams/${teamId}/apps`)

    if (!res.ok && res.status == 404) {
      return { status: AppsApiStatus.NoApps, data: null }
    }

    if (!res.ok) {
      return { status: AppsApiStatus.Error, data: null }
    }

    const data = await res.json()
    return { status: AppsApiStatus.Success, data: data }
  } catch {
    return { status: AppsApiStatus.Cancelled, data: null }
  }
}

export const fetchRootSpanNamesFromServer = async (selectedApp: App) => {
  try {
    const res = await measureAuth.fetchMeasure(
      `/api/apps/${selectedApp.id}/spans/roots/names`,
    )

    if (!res.ok) {
      return { status: RootSpanNamesApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (data.results === null) {
      return { status: RootSpanNamesApiStatus.NoData, data: null }
    }

    return { status: RootSpanNamesApiStatus.Success, data: data }
  } catch {
    return { status: RootSpanNamesApiStatus.Cancelled, data: null }
  }
}

export const fetchSpansFromServer = async (
  filters: Filters,
  limit: number,
  offset: number,
) => {
  var url = `/api/apps/${filters.app!.id}/spans?`

  url = await applyGenericFiltersToUrl(url, filters, limit, offset)
  url = appendSpanFiltersToUrl(url, filters)

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: SpansApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: SpansApiStatus.Success, data: data }
  } catch {
    return { status: SpansApiStatus.Cancelled, data: null }
  }
}

export const fetchSpanMetricsPlotFromServer = async (filters: Filters) => {
  var url = `/api/apps/${filters.app!.id}/spans/plots/metrics?`

  url = await applyGenericFiltersToUrl(url, filters, null, null)
  url = appendSpanFiltersToUrl(url, filters)
  url = appendPlotTimeGroupToUrl(url, filters)

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: SpanMetricsPlotApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (data === null) {
      return { status: SpanMetricsPlotApiStatus.NoData, data: null }
    }

    return { status: SpanMetricsPlotApiStatus.Success, data: data }
  } catch {
    return { status: SpanMetricsPlotApiStatus.Cancelled, data: null }
  }
}

export const fetchTraceFromServer = async (appId: string, traceId: string) => {
  try {
    const res = await measureAuth.fetchMeasure(
      `/api/apps/${appId}/traces/${traceId}`,
    )
    if (!res.ok) {
      return { status: TraceApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: TraceApiStatus.Success, data: data }
  } catch {
    return { status: TraceApiStatus.Cancelled, data: null }
  }
}

export const fetchFiltersFromServer = async (
  selectedApp: App,
  filterSource: FilterSource,
) => {
  let url = `/api/apps/${selectedApp.id}/filters`

  // fetch the user defined attributes
  url += "?ud_attr_keys=1"

  // if filter is for Crashes, Anrs or Spans we append a query param indicating it
  if (filterSource === FilterSource.Crashes) {
    url += "&crash=1"
  } else if (filterSource === FilterSource.Anrs) {
    url += "&anr=1"
  } else if (filterSource === FilterSource.Spans) {
    url += "&span=1"
  }

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: FiltersApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (data.versions === null) {
      if (!selectedApp.onboarded) {
        return { status: FiltersApiStatus.NotOnboarded, data: null }
      } else {
        return { status: FiltersApiStatus.NoData, data: null }
      }
    }

    return { status: FiltersApiStatus.Success, data: data }
  } catch {
    return { status: FiltersApiStatus.Cancelled, data: null }
  }
}

export const fetchSessionsVsExceptionsPlotFromServer = async (
  filters: Filters,
) => {
  // Fetch all three datasets in parallel
  const [sessionsRes, crashesRes, anrsRes] = await Promise.all([
    fetchSessionTimelinesOverviewPlotFromServer(filters),
    fetchExceptionsOverviewPlotFromServer(ExceptionsType.Crash, filters),
    fetchExceptionsOverviewPlotFromServer(ExceptionsType.Anr, filters),
  ])

  // Handle error/no data
  if (
    sessionsRes.status !== SessionTimelinesOverviewPlotApiStatus.Success &&
    sessionsRes.status !== SessionTimelinesOverviewPlotApiStatus.NoData
  ) {
    return { status: SessionsVsExceptionsPlotApiStatus.Error, data: null }
  }
  if (
    crashesRes.status !== ExceptionsOverviewPlotApiStatus.Success &&
    crashesRes.status !== ExceptionsOverviewPlotApiStatus.NoData
  ) {
    return { status: SessionsVsExceptionsPlotApiStatus.Error, data: null }
  }
  if (
    anrsRes.status !== ExceptionsOverviewPlotApiStatus.Success &&
    anrsRes.status !== ExceptionsOverviewPlotApiStatus.NoData
  ) {
    return { status: SessionsVsExceptionsPlotApiStatus.Error, data: null }
  }

  // Helper to flatten and merge all series of a type into a map of date -> count
  function mergeSeries(seriesArr: any[], valueKey: string = "instances") {
    const dateMap: Record<string, number> = {}
    for (const series of seriesArr || []) {
      for (const point of series.data || []) {
        const date = point.datetime || point.x
        const value = point[valueKey] ?? point.y ?? 0
        dateMap[date] = (dateMap[date] || 0) + value
      }
    }
    return dateMap
  }

  // Merge all series for each type
  const sessionsMap = mergeSeries(sessionsRes.data || [])
  const crashesMap = mergeSeries(crashesRes.data || [])
  const anrsMap = mergeSeries(anrsRes.data || [])

  // Get all unique dates
  const allDates = Array.from(
    new Set([
      ...Object.keys(sessionsMap),
      ...Object.keys(crashesMap),
      ...Object.keys(anrsMap),
    ]),
  ).sort()

  // Build the final series arrays
  function buildSeries(id: string, map: Record<string, number>) {
    return {
      id,
      data: allDates.map((date, idx) => ({
        id: id + "." + idx,
        x: date,
        y: map[date] || 0,
      })),
    }
  }

  const result = [
    buildSeries("Sessions", sessionsMap),
    buildSeries("Crashes", crashesMap),
    buildSeries("ANRs", anrsMap),
  ]

  // If all are empty, return NoData
  if (result.every((series) => series.data.every((point) => point.y === 0))) {
    return { status: SessionsVsExceptionsPlotApiStatus.NoData, data: null }
  }

  // Remove ANRs if all y values are 0
  const filteredResult = result.filter((series) => {
    if (series.id === "ANRs") {
      return series.data.some((point) => point.y !== 0)
    }
    return true
  })

  return {
    status: SessionsVsExceptionsPlotApiStatus.Success,
    data: filteredResult,
  }
}

export const fetchJourneyFromServer = async (
  journeyType: JourneyType,
  exceptionsGroupdId: string | null,
  bidirectional: boolean,
  filters: Filters,
) => {
  // Must pass in exceptionsGroupdId if journey type is crash or anr details
  if (
    (journeyType === JourneyType.CrashDetails ||
      journeyType === JourneyType.AnrDetails) &&
    exceptionsGroupdId === undefined
  ) {
    return { status: JourneyApiStatus.Error, data: null }
  }

  let url = ""
  if (journeyType === JourneyType.CrashDetails) {
    url = `/api/apps/${filters.app!.id}/crashGroups/${exceptionsGroupdId}/plots/journey?`
  } else if (journeyType === JourneyType.AnrDetails) {
    url = `api/apps/${filters.app!.id}/anrGroups/${exceptionsGroupdId}/plots/journey?`
  } else {
    url = `/api/apps/${filters.app!.id}/journey?`
  }

  // Append bidirectional value
  url = url + `bigraph=${bidirectional ? "1&" : "0&"}`

  url = await applyGenericFiltersToUrl(url, filters, null, null)

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: JourneyApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: JourneyApiStatus.Success, data: data }
  } catch {
    return { status: JourneyApiStatus.Cancelled, data: null }
  }
}

export const fetchMetricsFromServer = async (filters: Filters) => {
  let url = `/api/apps/${filters.app!.id}/metrics?`

  url = await applyGenericFiltersToUrl(url, filters, null, null)

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: MetricsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: MetricsApiStatus.Success, data: data }
  } catch {
    return { status: MetricsApiStatus.Cancelled, data: null }
  }
}

export const fetchSessionTimelinesOverviewFromServer = async (
  filters: Filters,
  limit: number,
  offset: number,
) => {
  var url = `/api/apps/${filters.app!.id}/sessions?`

  url = await applyGenericFiltersToUrl(
    url,
    filters,
    limit,
    offset,
  )
  url = appendSessionTypesToUrl(url, filters)

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: SessionTimelinesOverviewApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: SessionTimelinesOverviewApiStatus.Success, data: data }
  } catch {
    return { status: SessionTimelinesOverviewApiStatus.Cancelled, data: null }
  }
}

export const fetchSessionTimelinesOverviewPlotFromServer = async (filters: Filters) => {
  var url = `/api/apps/${filters.app!.id}/sessions/plots/instances?`

  url = await applyGenericFiltersToUrl(url, filters, null, null)
  url = appendSessionTypesToUrl(url, filters)
  url = appendPlotTimeGroupToUrl(url, filters)

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: SessionTimelinesOverviewPlotApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (data === null) {
      return { status: SessionTimelinesOverviewPlotApiStatus.NoData, data: null }
    }

    return { status: SessionTimelinesOverviewPlotApiStatus.Success, data: data }
  } catch {
    return { status: SessionTimelinesOverviewPlotApiStatus.Cancelled, data: null }
  }
}

export const fetchExceptionsOverviewFromServer = async (
  exceptionsType: ExceptionsType,
  filters: Filters,
  limit: number,
  offset: number,
) => {
  var url = ""
  if (exceptionsType === ExceptionsType.Crash) {
    url = `/api/apps/${filters.app!.id}/crashGroups?`
  } else {
    url = `/api/apps/${filters.app!.id}/anrGroups?`
  }

  url = await applyGenericFiltersToUrl(url, filters, limit, offset)

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: ExceptionsOverviewApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: ExceptionsOverviewApiStatus.Success, data: data }
  } catch {
    return { status: ExceptionsOverviewApiStatus.Cancelled, data: null }
  }
}

export const fetchExceptionsDetailsFromServer = async (
  exceptionsType: ExceptionsType,
  exceptionsGroupdId: string,
  filters: Filters,
  limit: number,
  offset: number,
) => {
  var url = ""
  if (exceptionsType === ExceptionsType.Crash) {
    url = `/api/apps/${filters.app!.id}/crashGroups/${exceptionsGroupdId}/crashes?`
  } else {
    url = `/api/apps/${filters.app!.id}/anrGroups/${exceptionsGroupdId}/anrs?`
  }

  url = await applyGenericFiltersToUrl(
    url,
    filters,
    limit,
    offset,
  )

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: ExceptionsDetailsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: ExceptionsDetailsApiStatus.Success, data: data }
  } catch {
    return { status: ExceptionsDetailsApiStatus.Cancelled, data: null }
  }
}

export const fetchExceptionGroupCommonPathFromServer = async (
  type: ExceptionsType,
  appId: string,
  groupId: string
) => {
  var url = ""
  if (type === ExceptionsType.Crash) {
    url = `/api/apps/${appId}/crashGroups/${groupId}/path`
  } else {
    url = `/api/apps/${appId}/anrGroups/${groupId}/path`
  }

  try {
    const res = await measureAuth.fetchMeasure(url)
    console.log("Fetching exception group common path from:", url)

    if (!res.ok) {
      return { status: ExceptionGroupCommonPathApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: ExceptionGroupCommonPathApiStatus.Success, data: data }
  } catch {
    return { status: ExceptionGroupCommonPathApiStatus.Cancelled, data: null }
  }
}

export const fetchExceptionsOverviewPlotFromServer = async (
  exceptionsType: ExceptionsType,
  filters: Filters,
) => {
  var url = ""
  if (exceptionsType === ExceptionsType.Crash) {
    url = `/api/apps/${filters.app!.id}/crashGroups/plots/instances?`
  } else {
    url = `/api/apps/${filters.app!.id}/anrGroups/plots/instances?`
  }

  url = await applyGenericFiltersToUrl(url, filters, null, null)
  url = appendPlotTimeGroupToUrl(url, filters)

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: ExceptionsOverviewPlotApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (data === null) {
      return { status: ExceptionsOverviewPlotApiStatus.NoData, data: null }
    }

    return { status: ExceptionsOverviewPlotApiStatus.Success, data: data }
  } catch {
    return { status: ExceptionsOverviewPlotApiStatus.Cancelled, data: null }
  }
}

export const fetchExceptionsDetailsPlotFromServer = async (
  exceptionsType: ExceptionsType,
  exceptionsGroupdId: string,
  filters: Filters,
) => {
  var url = ""
  if (exceptionsType === ExceptionsType.Crash) {
    url = `/api/apps/${filters.app!.id}/crashGroups/${exceptionsGroupdId}/plots/instances?`
  } else {
    url = `/api/apps/${filters.app!.id}/anrGroups/${exceptionsGroupdId}/plots/instances?`
  }

  url = await applyGenericFiltersToUrl(url, filters, null, null)
  url = appendPlotTimeGroupToUrl(url, filters)

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: ExceptionsDetailsPlotApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (data === null) {
      return { status: ExceptionsDetailsPlotApiStatus.NoData, data: null }
    }

    return { status: ExceptionsDetailsPlotApiStatus.Success, data: data }
  } catch {
    return { status: ExceptionsDetailsPlotApiStatus.Cancelled, data: null }
  }
}

export const fetchExceptionsDistributionPlotFromServer = async (
  exceptionsType: ExceptionsType,
  exceptionsGroupdId: string,
  filters: Filters,
) => {
  var url = ""
  if (exceptionsType === ExceptionsType.Crash) {
    url = `/api/apps/${filters.app!.id}/crashGroups/${exceptionsGroupdId}/plots/distribution?`
  } else {
    url = `/api/apps/${filters.app!.id}/anrGroups/${exceptionsGroupdId}/plots/distribution?`
  }

  url = await applyGenericFiltersToUrl(url, filters, null, null)

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: ExceptionsDistributionPlotApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (
      data === null ||
      Object.values(data).every(
        (value) =>
          typeof value === "object" &&
          value !== null &&
          Object.keys(value).length === 0,
      )
    ) {
      return { status: ExceptionsDistributionPlotApiStatus.NoData, data: null }
    }

    return { status: ExceptionsDistributionPlotApiStatus.Success, data: data }
  } catch {
    return {
      status: ExceptionsDistributionPlotApiStatus.Cancelled,
      data: null,
    }
  }
}

export const fetchAuthzAndMembersFromServer = async (teamId: string) => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/teams/${teamId}/authz`)
    if (!res.ok) {
      return { status: AuthzAndMembersApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: AuthzAndMembersApiStatus.Success, data: data }
  } catch {
    return { status: AuthzAndMembersApiStatus.Cancelled, data: null }
  }
}

export const fetchSessionTimelineFromServer = async (
  appId: string,
  sessionId: string,
) => {
  try {
    const res = await measureAuth.fetchMeasure(
      `/api/apps/${appId}/sessions/${sessionId}`,
    )
    if (!res.ok) {
      return { status: SessionTimelineApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: SessionTimelineApiStatus.Success, data: data }
  } catch {
    return { status: SessionTimelineApiStatus.Cancelled, data: null }
  }
}

export const changeTeamNameFromServer = async (
  teamId: string,
  newTeamName: string,
) => {
  const opts = {
    method: "PATCH",
    body: JSON.stringify({ name: newTeamName }),
  }

  try {
    const res = await measureAuth.fetchMeasure(
      `/api/teams/${teamId}/rename`,
      opts,
    )
    if (!res.ok) {
      return { status: TeamNameChangeApiStatus.Error }
    }

    return { status: TeamNameChangeApiStatus.Success }
  } catch {
    return { status: TeamNameChangeApiStatus.Cancelled }
  }
}

export const createTeamFromServer = async (teamName: string) => {
  const opts = {
    method: "POST",
    body: JSON.stringify({ name: teamName }),
  }

  try {
    const res = await measureAuth.fetchMeasure(`/api/teams`, opts)
    const data = await res.json()

    if (!res.ok) {
      return { status: CreateTeamApiStatus.Error, error: data.error }
    }

    return { status: CreateTeamApiStatus.Success, data: data }
  } catch {
    return { status: CreateTeamApiStatus.Cancelled }
  }
}

export const createAppFromServer = async (teamId: string, appName: string) => {
  const opts = {
    method: "POST",
    body: JSON.stringify({ name: appName }),
  }

  try {
    const res = await measureAuth.fetchMeasure(
      `/api/teams/${teamId}/apps`,
      opts,
    )
    const data = await res.json()

    if (!res.ok) {
      return { status: CreateAppApiStatus.Error, error: data.error }
    }

    return { status: CreateAppApiStatus.Success, data: data }
  } catch {
    return { status: CreateAppApiStatus.Cancelled }
  }
}

export const changeRoleFromServer = async (
  teamId: string,
  newRole: string,
  memberId: string,
) => {
  const opts = {
    method: "PATCH",
    body: JSON.stringify({ role: newRole.toLocaleLowerCase() }),
  }

  try {
    const res = await measureAuth.fetchMeasure(
      `/api/teams/${teamId}/members/${memberId}/role`,
      opts,
    )
    const data = await res.json()

    if (!res.ok) {
      return { status: RoleChangeApiStatus.Error, error: data.error }
    }

    return { status: RoleChangeApiStatus.Success }
  } catch {
    return { status: RoleChangeApiStatus.Cancelled }
  }
}

export const fetchPendingInvitesFromServer = async (teamId: string) => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/teams/${teamId}/invites`)
    const data = await res.json()

    if (!res.ok) {
      return { status: PendingInvitesApiStatus.Error, error: data.error }
    }

    return { status: PendingInvitesApiStatus.Success, data: data }
  } catch {
    return { status: PendingInvitesApiStatus.Cancelled, data: null }
  }
}

export const resendPendingInviteFromServer = async (
  teamId: string,
  inviteId: string,
) => {
  const opts = {
    method: "PATCH",
  }

  try {
    const res = await measureAuth.fetchMeasure(
      `/api/teams/${teamId}/invite/${inviteId}`,
      opts,
    )
    const data = await res.json()

    if (!res.ok) {
      return { status: ResendPendingInviteApiStatus.Error, error: data.error }
    }

    return { status: ResendPendingInviteApiStatus.Success }
  } catch {
    return { status: ResendPendingInviteApiStatus.Cancelled }
  }
}

export const removePendingInviteFromServer = async (
  teamId: string,
  inviteId: string,
) => {
  const opts = {
    method: "DELETE",
  }

  try {
    const res = await measureAuth.fetchMeasure(
      `/api/teams/${teamId}/invite/${inviteId}`,
      opts,
    )
    const data = await res.json()

    if (!res.ok) {
      return { status: RemovePendingInviteApiStatus.Error, error: data.error }
    }

    return { status: RemovePendingInviteApiStatus.Success }
  } catch {
    return { status: RemovePendingInviteApiStatus.Cancelled }
  }
}

export const inviteMemberFromServer = async (
  teamId: string,
  email: string,
  role: string,
) => {
  const lowerCaseRole = role.toLocaleLowerCase()
  const opts = {
    method: "POST",
    headers: {
      "Content-Type": `application/json`,
    },
    body: JSON.stringify([{ email: email, role: lowerCaseRole }]),
  }

  try {
    const res = await measureAuth.fetchMeasure(
      `/api/teams/${teamId}/invite`,
      opts,
    )
    const data = await res.json()

    if (!res.ok) {
      return { status: InviteMemberApiStatus.Error, error: data.error }
    }

    return { status: InviteMemberApiStatus.Success }
  } catch {
    return { status: InviteMemberApiStatus.Cancelled }
  }
}

export const removeMemberFromServer = async (
  teamId: string,
  memberId: string,
) => {
  const opts = {
    method: "DELETE",
  }

  try {
    const res = await measureAuth.fetchMeasure(
      `/api/teams/${teamId}/members/${memberId}`,
      opts,
    )
    const data = await res.json()

    if (!res.ok) {
      return { status: RemoveMemberApiStatus.Error, error: data.error }
    }

    return { status: RemoveMemberApiStatus.Success }
  } catch {
    return { status: RemoveMemberApiStatus.Cancelled }
  }
}

export const fetchTeamSlackConnectUrlFromServer = async (userId: string, teamId: string, redirectUrl: string) => {
  try {
    const res = await measureAuth.fetchMeasure(`/auth/slack/url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, teamId, redirectUrl }),
    })
    const data = await res.json()

    if (!res.ok) {
      return { status: FetchTeamSlackConnectUrlApiStatus.Error, error: data.error }
    }

    return { status: FetchTeamSlackConnectUrlApiStatus.Success, data: data }
  } catch {
    return { status: FetchTeamSlackConnectUrlApiStatus.Cancelled, data: null }
  }
}

export const fetchTeamSlackStatusFromServer = async (teamId: string) => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/teams/${teamId}/slack`)
    const data = await res.json()

    if (!res.ok) {
      return { status: FetchTeamSlackStatusApiStatus.Error, error: data.error }
    }

    return { status: FetchTeamSlackStatusApiStatus.Success, data: data }
  } catch {
    return { status: FetchTeamSlackStatusApiStatus.Cancelled, data: null }
  }
}

export const fetchAppThresholdPrefsFromServer = async (appId: string) => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/apps/${appId}/thresholdPrefs`)
    const data = await res.json()

    if (!res.ok) {
      return { status: FetchAppThresholdPrefsApiStatus.Error, error: data.error, data: null }
    }

    return { status: FetchAppThresholdPrefsApiStatus.Success, data: data }
  } catch {
    return { status: FetchAppThresholdPrefsApiStatus.Cancelled, data: null }
  }
}

export const updateAppThresholdPrefsFromServer = async (
  appId: string,
  prefs: typeof defaultAppThresholdPrefs,
) => {
  const opts = {
    method: "PATCH",
    body: JSON.stringify(prefs),
  }

  try {
    const res = await measureAuth.fetchMeasure(
      `/api/apps/${appId}/thresholdPrefs`,
      opts,
    )
    const data = await res.json()

    if (!res.ok) {
      return { status: UpdateAppThresholdPrefsApiStatus.Error, error: data.error }
    }

    return { status: UpdateAppThresholdPrefsApiStatus.Success }
  } catch {
    return { status: UpdateAppThresholdPrefsApiStatus.Cancelled }
  }
}

export const updateTeamSlackStatusFromServer = async (
  teamId: string,
  slackStatus: boolean,
) => {
  const opts = {
    method: "PATCH",
    body: JSON.stringify({ is_active: slackStatus }),
  }

  try {
    const res = await measureAuth.fetchMeasure(
      `/api/teams/${teamId}/slack/status`,
      opts,
    )
    const data = await res.json()

    if (!res.ok) {
      return { status: UpdateTeamSlackStatusApiStatus.Error, error: data.error }
    }

    return { status: UpdateTeamSlackStatusApiStatus.Success }
  } catch {
    return { status: UpdateTeamSlackStatusApiStatus.Cancelled }
  }
}

export const sendTestSlackAlertFromServer = async (
  teamId: string,
) => {
  const opts = {
    method: "POST"
  }

  try {
    const res = await measureAuth.fetchMeasure(
      `/api/teams/${teamId}/slack/test`,
      opts,
    )
    const data = await res.json()

    if (!res.ok) {
      return { status: TestSlackAlertApiStatus.Error, error: data.error }
    }

    return { status: TestSlackAlertApiStatus.Success }
  } catch {
    return { status: TestSlackAlertApiStatus.Cancelled }
  }
}

export const fetchAlertPrefsFromServer = async (appId: string) => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/apps/${appId}/alertPrefs`)

    if (!res.ok) {
      return { status: FetchAlertPrefsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: FetchAlertPrefsApiStatus.Success, data: data }
  } catch {
    return { status: FetchAlertPrefsApiStatus.Cancelled, data: null }
  }
}

export const updateAlertPrefsFromServer = async (
  appdId: string,
  alertPrefs: typeof emptyAlertPrefs,
) => {
  const opts = {
    method: "PATCH",
    body: JSON.stringify(alertPrefs),
  }

  try {
    const res = await measureAuth.fetchMeasure(
      `/api/apps/${appdId}/alertPrefs`,
      opts,
    )
    const data = await res.json()

    if (!res.ok) {
      return { status: UpdateAlertPrefsApiStatus.Error, error: data.error }
    }

    return { status: UpdateAlertPrefsApiStatus.Success }
  } catch {
    return { status: UpdateAlertPrefsApiStatus.Cancelled }
  }
}

export const fetchAppRetentionFromServer = async (appId: string) => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/apps/${appId}/retention`)

    if (!res.ok) {
      return { status: FetchAppRetentionApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: FetchAppRetentionApiStatus.Success, data: data }
  } catch {
    return { status: FetchAppRetentionApiStatus.Cancelled, data: null }
  }
}

export const updateAppRetentionFromServer = async (
  appdId: string,
  appRetention: typeof emptyAppRetention,
) => {
  const opts = {
    method: "PATCH",
    body: JSON.stringify(appRetention),
  }

  try {
    const res = await measureAuth.fetchMeasure(
      `/api/apps/${appdId}/retention`,
      opts,
    )
    const data = await res.json()

    if (!res.ok) {
      return { status: UpdateAppRetentionApiStatus.Error, error: data.error }
    }

    return { status: UpdateAppRetentionApiStatus.Success }
  } catch {
    return { status: UpdateAppRetentionApiStatus.Cancelled }
  }
}

export const changeAppNameFromServer = async (
  appId: string,
  newAppName: string,
) => {
  const opts = {
    method: "PATCH",
    body: JSON.stringify({ name: newAppName }),
  }

  try {
    const res = await measureAuth.fetchMeasure(
      `/api/apps/${appId}/rename`,
      opts,
    )
    if (!res.ok) {
      return { status: AppNameChangeApiStatus.Error }
    }

    return { status: AppNameChangeApiStatus.Success }
  } catch {
    return { status: AppNameChangeApiStatus.Cancelled }
  }
}

export const changeAppApiKeyFromServer = async (appId: string) => {
  const opts = {
    method: "PATCH",
  }

  try {
    const res = await measureAuth.fetchMeasure(`/api/apps/${appId}/apiKey`, opts)
    if (!res.ok) {
      return { status: AppApiKeyChangeApiStatus.Error }
    }

    return { status: AppApiKeyChangeApiStatus.Success }
  } catch {
    return { status: AppApiKeyChangeApiStatus.Cancelled }
  }
}

export const fetchBillingInfoFromServer = async (teamId: string) => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/teams/${teamId}/billing/info`)

    if (!res.ok) {
      return { status: FetchBillingInfoApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: FetchBillingInfoApiStatus.Success, data: data }
  } catch {
    return { status: FetchBillingInfoApiStatus.Cancelled, data: null }
  }
}

export const fetchSubscriptionInfoFromServer = async (teamId: string) => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/teams/${teamId}/billing/subscriptionInfo`)

    if (!res.ok) {
      return { status: FetchSubscriptionInfoApiStatus.Error, data: null }
    }

    const data = await res.json()
    return { status: FetchSubscriptionInfoApiStatus.Success, data: data }
  } catch {
    return { status: FetchSubscriptionInfoApiStatus.Cancelled, data: null }
  }
}

export const fetchBillingUsageThresholdFromServer = async (teamId: string) => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/teams/${teamId}/billing/usageThreshold`)

    if (!res.ok) {
      return { status: FetchBillingUsageThresholdApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: FetchBillingUsageThresholdApiStatus.Success, data: data as { threshold: number } }
  } catch {
    return { status: FetchBillingUsageThresholdApiStatus.Cancelled, data: null }
  }
}

export const fetchUsageFromServer = async (teamId: string) => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/teams/${teamId}/usage`)

    if (!res.ok && res.status == 404) {
      return { status: FetchUsageApiStatus.NoApps, data: null }
    }

    if (!res.ok) {
      return { status: FetchUsageApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: FetchUsageApiStatus.Success, data: data }
  } catch {
    return { status: FetchUsageApiStatus.Cancelled, data: null }
  }
}

export const fetchStripeCheckoutSessionFromServer = async (
  teamId: string,
  successUrl: string,
  cancelUrl: string
) => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/teams/${teamId}/billing/checkout`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    })

    if (!res.ok) {
      return { status: FetchStripeCheckoutSessionApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: FetchStripeCheckoutSessionApiStatus.Success, data: data }
  } catch {
    return { status: FetchStripeCheckoutSessionApiStatus.Cancelled, data: null }
  }
}

export const downgradeToFreeFromServer = async (teamId: string) => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/teams/${teamId}/billing/downgrade`, {
      method: 'PATCH',
    })

    if (!res.ok) {
      return { status: DowngradeToFreeApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: DowngradeToFreeApiStatus.Success, data: data }
  } catch {
    return { status: DowngradeToFreeApiStatus.Cancelled, data: null }
  }
}

export const fetchBugReportsOverviewFromServer = async (
  filters: Filters,
  limit: number,
  offset: number,
) => {
  var url = `/api/apps/${filters.app!.id}/bugReports?`

  url = await applyGenericFiltersToUrl(url, filters, limit, offset)
  url = appendBugReportStatusesToUrl(url, filters)

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: BugReportsOverviewApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: BugReportsOverviewApiStatus.Success, data: data }
  } catch {
    return { status: BugReportsOverviewApiStatus.Cancelled, data: null }
  }
}

export const fetchBugReportsOverviewPlotFromServer = async (
  filters: Filters,
) => {
  var url = `/api/apps/${filters.app!.id}/bugReports/plots/instances?`

  url = await applyGenericFiltersToUrl(url, filters, null, null)
  url = appendBugReportStatusesToUrl(url, filters)
  url = appendPlotTimeGroupToUrl(url, filters)

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: BugReportsOverviewPlotApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (data === null) {
      return { status: BugReportsOverviewPlotApiStatus.NoData, data: null }
    }

    return { status: BugReportsOverviewPlotApiStatus.Success, data: data }
  } catch {
    return { status: BugReportsOverviewPlotApiStatus.Cancelled, data: null }
  }
}

export const fetchBugReportFromServer = async (
  appId: string,
  bugReportId: string,
) => {
  try {
    const res = await measureAuth.fetchMeasure(
      `/api/apps/${appId}/bugReports/${bugReportId}`,
    )
    if (!res.ok) {
      return { status: BugReportApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: BugReportApiStatus.Success, data: data }
  } catch {
    return { status: BugReportApiStatus.Cancelled, data: null }
  }
}

export const updateBugReportStatusFromServer = async (
  appId: string,
  bugReportId: string,
  status: number,
) => {
  const opts = {
    method: "PATCH",
    body: JSON.stringify({ status: Number(status) }),
  }

  try {
    const res = await measureAuth.fetchMeasure(
      `/api/apps/${appId}/bugReports/${bugReportId}`,
      opts,
    )
    const data = await res.json()

    if (!res.ok) {
      return {
        status: UpdateBugReportStatusApiStatus.Error,
        error: data.error,
      }
    }

    return { status: UpdateBugReportStatusApiStatus.Success }
  } catch {
    return { status: UpdateBugReportStatusApiStatus.Cancelled }
  }
}

export const fetchAlertsOverviewFromServer = async (
  filters: Filters,
  limit: number,
  offset: number,
) => {
  var url = `/api/apps/${filters.app!.id}/alerts?`

  url = await applyGenericFiltersToUrl(url, filters, limit, offset)

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: AlertsOverviewApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: AlertsOverviewApiStatus.Success, data: data }
  } catch {
    return { status: AlertsOverviewApiStatus.Cancelled, data: null }
  }
}

export const fetchSdkConfigFromServer = async (appId: String) => {
  const url = `/api/apps/${appId}/config`

  try {
    const res = await measureAuth.fetchMeasure(url)
    if (!res.ok) {
      return { status: SdkConfigApiStatus.Error, data: null }
    }
    const data = await res.json()
    return { status: SdkConfigApiStatus.Success, data: data }
  } catch {
    return { status: SdkConfigApiStatus.Cancelled, data: null }
  }
}

export const updateSdkConfigFromServer = async (appId: string, config: Partial<SdkConfig>) => {
  const url = `/api/apps/${appId}/config`

  const opts = {
    method: "PATCH",
    body: JSON.stringify(config),
  }

  try {
    const res = await measureAuth.fetchMeasure(url, opts)
    const data = await res.json()

    if (!res.ok) {
      return {
        status: UpdateSdkConfigApiStatus.Error,
        data: null,
        error: data?.error,
      }
    }

    return {
      status: UpdateSdkConfigApiStatus.Success,
      data,
    }
  } catch {
    return {
      status: UpdateSdkConfigApiStatus.Cancelled,
      data: null,
    }
  }
}
