import { measureAuth } from "../auth/measure_auth"
import { Filters } from "../components/filters"
import { JourneyType } from "../components/journey"
import {
  formatUserInputDateToServerFormat,
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

export enum SessionsOverviewApiStatus {
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

export enum SessionsOverviewPlotApiStatus {
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

export enum FetchAppSettingsApiStatus {
  Loading,
  Success,
  Error,
  Cancelled,
}

export enum UpdateAppSettingsApiStatus {
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

export enum DataFiltersApiStatus {
  Loading,
  Success,
  Error,
  NoFilters,
  Cancelled,
}


export enum SessionType {
  All = "All Sessions",
  Crashes = "Crash Sessions",
  ANRs = "ANR Sessions",
  Issues = "Crash & ANR Sessions",
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
  },
}

export const emptySessionsOverviewResponse = {
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
  can_invite: ["viewer"],
  members: [
    {
      id: "",
      name: null,
      email: "",
      role: "",
      last_sign_in_at: "",
      created_at: "",
      authz: {
        can_change_roles: [""],
        can_remove: true,
      },
    },
  ],
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

export const emptyAppSettings = {
  retention_period: 30,
}

export const emptyUsage = [
  {
    app_id: "",
    app_name: "",
    monthly_app_usage: [
      {
        month_year: "",
        event_count: 0,
        session_count: 0,
        trace_count: 0,
        span_count: 0,
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

export type DataFiltersResponse = {
  meta: {
    next: false,
    previous: false,
  },
  results: DataFilter[],
}

export type DataFilterType = "event" | "trace" | "all_events" | "all_traces";

export type DataFilterCollectionConfig =
  | { mode: 'sample_rate'; sample_rate: number }
  | { mode: 'timeline_only' }
  | { mode: 'disable' };

export type DataFilterAttachmentConfig = 'layout_snapshot' | 'screenshot' | 'none';

export type DataFilter = {
  id: string,
  type: DataFilterType,
  filter: string,
  collection_config: DataFilterCollectionConfig,
  attachment_config: DataFilterAttachmentConfig | null,
  created_at: string,
  created_by: string,
  updated_at: string,
  updated_by: string,
}

export const emptyDataFiltersResponse: DataFiltersResponse = {
  meta: {
    next: false,
    previous: false,
  },
  results: [
    {
      id: "df-global-001",
      type: "all_events",
      filter: 'event_type == "*"',
      collection_config: { mode: 'timeline_only'},
      attachment_config: 'none',
      created_at: "2024-01-01T00:00:00Z",
      created_by: "system@example.com",
      updated_at: "2024-01-01T00:00:00Z",
      updated_by: "system@example.com",
    },
    {
      id: "df-global-002",
      type: "all_traces",
      filter: 'span.name == "*"',
      collection_config: { mode: 'sample_rate', sample_rate: 1 },
      attachment_config: 'none',
      created_at: "2024-01-01T00:00:00Z",
      created_by: "system@example.com",
      updated_at: "2024-01-01T00:00:00Z",
      updated_by: "system@example.com",
    },
    {
      id: "df-001",
      type: "event",
      filter: "event.type == 'click' && event.target == 'checkout_button'",
      collection_config: { mode: 'sample_rate', sample_rate: 0.5 },
      attachment_config: 'screenshot',
      created_at: "2024-01-15T10:30:00Z",
      created_by: "user1@example.com",
      updated_at: "2024-02-20T14:45:00Z",
      updated_by: "user2@example.com",
    },
    {
      id: "df-002",
      type: "trace",
      filter: "trace.duration > 5000 && trace.status == 'error'",
      collection_config: { mode: 'timeline_only' },
      attachment_config: 'layout_snapshot',
      created_at: "2024-01-20T08:15:00Z",
      created_by: "admin@example.com",
      updated_at: "2024-01-20T08:15:00Z",
      updated_by: "admin@example.com",
    },
    {
      id: "df-003",
      type: "event",
      filter: "event.name == 'app_background' && session.is_crash == true",
      collection_config: { mode: 'disable' },
      attachment_config: null,
      created_at: "2024-02-01T12:00:00Z",
      created_by: "developer@example.com",
      updated_at: "2024-03-10T09:30:00Z",
      updated_by: "lead@example.com",
    },
    {
      id: "df-004",
      type: "trace",
      filter: "trace.name == 'network_request' && trace.http.status_code >= 400",
      collection_config: { mode: 'sample_rate', sample_rate: 0.25 },
      attachment_config: 'none',
      created_at: "2024-02-10T16:20:00Z",
      created_by: "qa@example.com",
      updated_at: "2024-02-28T11:15:00Z",
      updated_by: "qa@example.com",
    },
    {
      id: "df-005",
      type: "event",
      filter: "event.type == 'gesture' && device.manufacturer == 'Samsung'",
      collection_config: { mode: 'sample_rate', sample_rate: 1.0 },
      attachment_config: 'screenshot',
      created_at: "2024-03-05T13:45:00Z",
      created_by: "user3@example.com",
      updated_at: "2024-03-05T13:45:00Z",
      updated_by: "user3@example.com",
    },
  ],
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
    filters.versions.length === 0 &&
    filters.osVersions.length === 0 &&
    filters.countries.length === 0 &&
    filters.networkProviders.length === 0 &&
    filters.networkTypes.length === 0 &&
    filters.networkGenerations.length === 0 &&
    filters.locales.length === 0 &&
    filters.deviceManufacturers.length === 0 &&
    filters.deviceNames.length === 0 &&
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

  const bodyFilters: any = {
    versions: filters.versions.map((v) => v.name),
    version_codes: filters.versions.map((v) => v.code),
    os_names: filters.osVersions.map((v) => v.name),
    os_versions: filters.osVersions.map((v) => v.version),
    countries: filters.countries,
    network_providers: filters.networkProviders,
    network_types: filters.networkTypes,
    network_generations: filters.networkGenerations,
    locales: filters.locales,
    device_manufacturers: filters.deviceManufacturers,
    device_names: filters.deviceNames,
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
  keyId: string | null,
  keyTimestamp: string | null,
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

  // Append session type if needed
  if (filters.sessionType === SessionType.Issues) {
    searchParams.append("crash", "1")
    searchParams.append("anr", "1")
  } else if (filters.sessionType === SessionType.Crashes) {
    searchParams.append("crash", "1")
  } else if (filters.sessionType === SessionType.ANRs) {
    searchParams.append("anr", "1")
  }

  // Append span name if needed
  if (filters.rootSpanName !== "") {
    searchParams.append("span_name", encodeURIComponent(filters.rootSpanName))
  }

  // Append span statuses if needed
  if (filters.spanStatuses.length > 0) {
    filters.spanStatuses.forEach((v) => {
      if (v === SpanStatus.Unset) {
        searchParams.append("span_statuses", "0")
      } else if (v === SpanStatus.Ok) {
        searchParams.append("span_statuses", "1")
      } else if (v === SpanStatus.Error) {
        searchParams.append("span_statuses", "2")
      }
    })
  }

  // Append bug report statuses if needed
  if (filters.bugReportStatuses.length > 0) {
    filters.bugReportStatuses.forEach((v) => {
      if (v === BugReportStatus.Open) {
        searchParams.append("bug_report_statuses", "0")
      } else if (v === BugReportStatus.Closed) {
        searchParams.append("bug_report_statuses", "1")
      }
    })
  }

  // Append free text if present
  if (filters.freeText !== "") {
    searchParams.append("free_text", filters.freeText)
  }

  // Append keyId if present
  if (keyId !== null) {
    searchParams.append("key_id", keyId)
  }

  // Append keyTimestamp if present
  if (keyTimestamp !== null) {
    searchParams.append("key_timestamp", keyTimestamp)
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

  url = await applyGenericFiltersToUrl(url, filters, null, null, limit, offset)

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

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

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
    fetchSessionsOverviewPlotFromServer(filters),
    fetchExceptionsOverviewPlotFromServer(ExceptionsType.Crash, filters),
    fetchExceptionsOverviewPlotFromServer(ExceptionsType.Anr, filters),
  ])

  // Handle error/no data
  if (
    sessionsRes.status !== SessionsOverviewPlotApiStatus.Success &&
    sessionsRes.status !== SessionsOverviewPlotApiStatus.NoData
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

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

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

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

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

export const fetchSessionsOverviewFromServer = async (
  filters: Filters,
  keyId: string | null,
  keyTimestamp: string | null,
  limit: number,
  offset: number,
) => {
  var url = `/api/apps/${filters.app!.id}/sessions?`

  url = await applyGenericFiltersToUrl(
    url,
    filters,
    keyId,
    keyTimestamp,
    limit,
    offset,
  )

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: SessionsOverviewApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: SessionsOverviewApiStatus.Success, data: data }
  } catch {
    return { status: SessionsOverviewApiStatus.Cancelled, data: null }
  }
}

export const fetchSessionsOverviewPlotFromServer = async (filters: Filters) => {
  var url = `/api/apps/${filters.app!.id}/sessions/plots/instances?`

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: SessionsOverviewPlotApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (data === null) {
      return { status: SessionsOverviewPlotApiStatus.NoData, data: null }
    }

    return { status: SessionsOverviewPlotApiStatus.Success, data: data }
  } catch {
    return { status: SessionsOverviewPlotApiStatus.Cancelled, data: null }
  }
}

export const fetchExceptionsOverviewFromServer = async (
  exceptionsType: ExceptionsType,
  filters: Filters,
  keyId: string | null,
  limit: number,
) => {
  var url = ""
  if (exceptionsType === ExceptionsType.Crash) {
    url = `/api/apps/${filters.app!.id}/crashGroups?`
  } else {
    url = `/api/apps/${filters.app!.id}/anrGroups?`
  }

  url = await applyGenericFiltersToUrl(url, filters, keyId, null, limit, null)

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
  keyId: string | null,
  keyTimestamp: string | null,
  limit: number,
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
    keyId,
    keyTimestamp,
    limit,
    null,
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

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

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

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

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

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

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

export const fetchAppSettingsFromServer = async (appId: string) => {
  try {
    const res = await measureAuth.fetchMeasure(`/api/apps/${appId}/settings`)

    if (!res.ok) {
      return { status: FetchAppSettingsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: FetchAppSettingsApiStatus.Success, data: data }
  } catch {
    return { status: FetchAppSettingsApiStatus.Cancelled, data: null }
  }
}

export const updateAppSettingsFromServer = async (
  appdId: string,
  appSettings: typeof emptyAppSettings,
) => {
  const opts = {
    method: "PATCH",
    body: JSON.stringify(appSettings),
  }

  try {
    const res = await measureAuth.fetchMeasure(
      `/api/apps/${appdId}/settings`,
      opts,
    )
    const data = await res.json()

    if (!res.ok) {
      return { status: UpdateAppSettingsApiStatus.Error, error: data.error }
    }

    return { status: UpdateAppSettingsApiStatus.Success }
  } catch {
    return { status: UpdateAppSettingsApiStatus.Cancelled }
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

export const fetchBugReportsOverviewFromServer = async (
  filters: Filters,
  limit: number,
  offset: number,
) => {
  var url = `/api/apps/${filters.app!.id}/bugReports?`

  url = await applyGenericFiltersToUrl(url, filters, null, null, limit, offset)

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

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

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

  url = await applyGenericFiltersToUrl(url, filters, null, null, limit, offset)

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

export const fetchDataFiltersFromServer = async (
  appId: String,
  type?: string,
) => {
  let url = `/api/apps/${appId}/dataFilters`
  if (type) {
    url += `?type=${type}`
  }

  try {
    const res = await measureAuth.fetchMeasure(url)

    if (!res.ok) {
      return { status: DataFiltersApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (data.results === null) {
      return { status: DataFiltersApiStatus.NoFilters, data: null }
    } else {
      return { status: DataFiltersApiStatus.Success, data: data }
    }
  } catch {
    return { status: DataFiltersApiStatus.Cancelled, data: null }
  }
}