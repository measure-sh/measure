import { auth, fetchMeasure, logoutIfAuthError } from "@/app/utils/auth/auth";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Filters } from "../components/filters";
import { JourneyType } from "../components/journey";
import { formatUserInputDateToServerFormat, getTimeZoneForServer } from "../utils/time_utils";

export enum TeamsApiStatus {
  Loading,
  Success,
  Error,
  Cancelled
}

export enum AppsApiStatus {
  Loading,
  Success,
  Error,
  NoApps,
  Cancelled
}

export enum RootSpanNamesApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled
}

export enum SpanMetricsPlotApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled
}

export enum SpansApiStatus {
  Loading,
  Success,
  Error,
  Cancelled
}

export enum TraceApiStatus {
  Loading,
  Success,
  Error,
  Cancelled
}

export enum FiltersApiStatus {
  Loading,
  Success,
  Error,
  NotOnboarded,
  NoData,
  Cancelled
}
export enum SaveFiltersApiStatus {
  Loading,
  Success,
  Error,
  Cancelled
}

export enum FiltersApiType {
  All,
  Crash,
  Anr,
  Span
}

export enum JourneyApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled
}

export enum MetricsApiStatus {
  Loading,
  Success,
  Error,
  Cancelled
}

export enum SessionsOverviewApiStatus {
  Loading,
  Success,
  Error,
  Cancelled
}

export enum ExceptionsType {
  Crash,
  Anr
}

export enum ExceptionsOverviewApiStatus {
  Loading,
  Success,
  Error,
  Cancelled
}

export enum ExceptionsOverviewPlotApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled
}

export enum SessionsOverviewPlotApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled
}

export enum ExceptionsDetailsApiStatus {
  Loading,
  Success,
  Error,
  Cancelled
}

export enum ExceptionsDetailsPlotApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled
}
export enum ExceptionsDistributionPlotApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled
}

export enum CreateTeamApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled
}

export enum CreateAppApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled
}

export enum TeamNameChangeApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled
}

export enum AppNameChangeApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled
}

export enum RoleChangeApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled
}

export enum InviteMemberApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled
}

export enum RemoveMemberApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled
}

export enum AuthzAndMembersApiStatus {
  Loading,
  Success,
  Error,
  Cancelled
}

export enum SessionTimelineApiStatus {
  Loading,
  Success,
  Error,
  Cancelled
}

export enum FetchAlertPrefsApiStatus {
  Loading,
  Success,
  Error,
  Cancelled
}

export enum UpdateAlertPrefsApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled
}

export enum FetchAppSettingsApiStatus {
  Loading,
  Success,
  Error,
  Cancelled
}

export enum UpdateAppSettingsApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled
}

export enum FetchUsageApiStatus {
  Loading,
  Success,
  Error,
  NoApps,
  Cancelled
}

export enum BugReportsOverviewApiStatus {
  Loading,
  Success,
  Error,
  Cancelled
}

export enum BugReportsOverviewPlotApiStatus {
  Loading,
  Success,
  Error,
  NoData,
  Cancelled
}

export enum BugReportApiStatus {
  Loading,
  Success,
  Error,
  Cancelled
}

export enum UpdateBugReportStatusApiStatus {
  Init,
  Loading,
  Success,
  Error,
  Cancelled
}

export enum SessionType {
  All = 'All Sessions',
  Crashes = 'Crash Sessions',
  ANRs = 'ANR Sessions',
  Issues = 'Crash & ANR Sessions'
}

export enum SpanStatus {
  Unset = "Unset",
  Ok = "Ok",
  Error = "Error"
}

export enum BugReportStatus {
  Open = "Open",
  Closed = "Closed"
}

export const emptyTeam = { 'id': '', 'name': '' }

export const emptyApp = {
  "id": "",
  "team_id": "",
  "name": "",
  "api_key": {
    "created_at": "",
    "key": "",
    "last_seen": null,
    "revoked": false
  },
  "onboarded": false,
  "created_at": "",
  "updated_at": "",
  "platform": null,
  "onboarded_at": null,
  "unique_identifier": null
}

export const emptyJourney = {
  "links": [
    {
      "source": "",
      "target": "",
      "value": 0
    }
  ],
  "nodes": [
    {
      "id": "au.com.shiftyjelly.pocketcasts.ui.MainActivity",
      "issues": {
        "anrs": [
          {
            "id": "",
            "title": "",
            "count": 0
          },
        ],
        "crashes": [
          {
            "id": "",
            "title": "",
            "count": 0
          },
        ]
      }
    }
  ],
  "totalIssues": 0
}

export const emptyMetrics = {
  "adoption": {
    "all_versions": 0,
    "selected_version": 0,
    "adoption": 0,
    "nan": false
  },
  "anr_free_sessions": {
    "anr_free_sessions": 0,
    "delta": 0,
    "nan": false
  },
  "cold_launch": {
    "delta": 0,
    "nan": false,
    "p95": 0
  },
  "crash_free_sessions": {
    "crash_free_sessions": 0,
    "delta": 0,
    "nan": false
  },
  "hot_launch": {
    "delta": 0,
    "nan": false,
    "p95": 0
  },
  "perceived_anr_free_sessions": {
    "perceived_anr_free_sessions": 0,
    "delta": 0,
    "nan": false
  },
  "perceived_crash_free_sessions": {
    "perceived_crash_free_sessions": 0,
    "delta": 0,
    "nan": false
  },
  "sizes": {
    "average_app_size": 0,
    "selected_app_size": 0,
    "delta": 0,
    "nan": false
  },
  "warm_launch": {
    "delta": 0,
    "nan": false,
    "p95": 0
  }
}

export const emptySessionsOverviewResponse = {
  "meta": {
    "next": false,
    "previous": false
  },
  "results": [] as {
    "session_id": string,
    "app_id": string,
    "first_event_time": string,
    "last_event_time": string,
    "duration": string,
    "matched_free_text": string,
    "attribute": {
      "app_version": "",
      "app_build": "",
      "user_id": "",
      "device_name": "",
      "device_model": "",
      "device_manufacturer": "",
      "os_name": "",
      "os_version": ""
    },
  }[]
}

export const emptySpansResponse = {
  "meta": {
    "next": false,
    "previous": false
  },
  "results": [] as {
    "app_id": string,
    "span_name": string,
    "span_id": string,
    "trace_id": string,
    "status": number,
    "start_time": string,
    "end_time": string,
    "duration": number,
    "app_version": string,
    "app_build": string,
    "os_name": string,
    "os_version": string,
    "device_manufacturer": string,
    "device_model": string
  }[]
}

const emptyExceptionGroup = {
  "id": "",
  "app_id": "",
  "type": "",
  "message": "",
  "method_name": "",
  "file_name": "",
  "line_number": 0,
  "fingerprint": "",
  "count": 0,
  "percentage_contribution": 0,
  "created_at": "",
  "updated_at": ""
}

export const emptyExceptionsOverviewResponse = {
  "meta": {
    "next": false,
    "previous": false
  },
  "results": [] as typeof emptyExceptionGroup[]
}

const emptyCrashGroupDetails = {
  "id": "",
  "session_id": "",
  "timestamp": "",
  "type": "",
  "thread_name": "",
  "attribute": {
    "installation_id": "",
    "app_version": "",
    "app_build": "",
    "app_unique_id": "",
    "measure_sdk_version": "",
    "platform": "",
    "thread_name": "",
    "user_id": "",
    "device_name": "",
    "device_model": "",
    "device_manufacturer": "",
    "device_type": "",
    "device_is_foldable": false,
    "device_is_physical": false,
    "device_density_dpi": 0,
    "device_width_px": 0,
    "device_height_px": 0,
    "device_density": 0.0,
    "device_locale": "",
    "os_name": "",
    "os_version": "",
    "network_type": "",
    "network_provider": "",
    "network_generation": ""
  },
  "exception": {
    "title": "",
    "stacktrace": ""
  },
  "attachments": [
    {
      "id": "",
      "name": "",
      "type": "",
      "key": "",
      "location": ""
    }
  ],
  "threads": [
    {
      "name": "",
      "frames": [
        ""
      ]
    }
  ],
  "attributes": {}
}

export const emptyCrashExceptionsDetailsResponse = {
  "meta": {
    "next": true,
    "previous": false
  },
  "results": [] as typeof emptyCrashGroupDetails[]
}

const emptyAnrGroupDetails = {
  "id": "",
  "session_id": "",
  "timestamp": "",
  "type": "",
  "thread_name": "",
  "attribute": {
    "installation_id": "",
    "app_version": "",
    "app_build": "",
    "app_unique_id": "",
    "measure_sdk_version": "",
    "platform": "",
    "thread_name": "",
    "user_id": "",
    "device_name": "",
    "device_model": "",
    "device_manufacturer": "",
    "device_type": "",
    "device_is_foldable": false,
    "device_is_physical": false,
    "device_density_dpi": 0,
    "device_width_px": 0,
    "device_height_px": 0,
    "device_density": 0.0,
    "device_locale": "",
    "os_name": "",
    "os_version": "",
    "network_type": "",
    "network_provider": "",
    "network_generation": ""
  },
  "anr": {
    "title": "",
    "stacktrace": ""
  },
  "attachments": [
    {
      "id": "",
      "name": "",
      "type": "",
      "key": "",
      "location": ""
    }
  ],
  "threads": [
    {
      "name": "",
      "frames": [
        ""
      ]
    }
  ],
  "attributes": {}
}

export const emptyAnrExceptionsDetailsResponse = {
  "meta": {
    "next": true,
    "previous": false
  },
  "results": [] as typeof emptyAnrGroupDetails[]
}

export const defaultAuthzAndMembers = {
  "can_invite": [
    "viewer"
  ],
  "members": [
    {
      "id": "",
      "name": null,
      "email": "",
      "role": "",
      "last_sign_in_at": "",
      "created_at": "",
      "authz": {
        "can_change_roles": [
          ""
        ],
        "can_remove": true
      }
    }
  ]
}

export const emptySessionTimeline = {
  "app_id": "2b7ddad4-40a6-42a7-9e21-a90577e08263",
  "attribute": {
    "installation_id": "",
    "app_version": "",
    "app_build": "",
    "app_unique_id": "",
    "measure_sdk_version": "",
    "platform": "",
    "thread_name": "",
    "user_id": "",
    "device_name": "",
    "device_model": "",
    "device_manufacturer": "",
    "device_type": "",
    "device_is_foldable": true,
    "device_is_physical": false,
    "device_density_dpi": 0,
    "device_width_px": 0,
    "device_height_px": 0,
    "device_density": 0.0,
    "device_locale": "",
    "os_name": "",
    "os_version": "",
    "network_type": "",
    "network_provider": "",
    "network_generation": ""
  },
  "cpu_usage": [
    {
      "timestamp": "",
      "value": 0.0
    }
  ],
  "duration": 0,
  "memory_usage": [
    {
      "java_max_heap": 0,
      "java_total_heap": 0,
      "java_free_heap": 0,
      "total_pss": 0,
      "rss": 0,
      "native_total_heap": 0,
      "native_free_heap": 0,
      "interval": 0,
      "timestamp": ""
    }
  ],
  "memory_usage_absolute": [
    {
      "max_memory": 0,
      "used_memory": 0,
      "interval": 0,
      "timestamp": ""
    }
  ],
  "session_id": "",
  "threads": {
    "main": [
      {
        "event_type": "lifecycle_activity",
        "thread_name": "",
        "type": "",
        "class_name": "",
        "intent": "",
        "saved_instance_state": false,
        "timestamp": ""
      },
      {
        "event_type": "lifecycle_app",
        "thread_name": "",
        "type": "",
        "timestamp": ""
      },
      {
        "event_type": "exception",
        "type": "",
        "message": "",
        "method_name": "",
        "file_name": "",
        "line_number": 0,
        "thread_name": "",
        "handled": false,
        "stacktrace": "",
        "foreground": true,
        "timestamp": "",
        "attachments": [
          {
            "id": "",
            "name": "",
            "type": "",
            "key": "",
            "location": ""
          }
        ]
      }
    ]
  },
  "traces": [
    {
      "trace_id": "847be6f84f004045d9deebea9b2fafe7",
      "trace_name": "root",
      "thread_name": "Thread-2",
      "start_time": "2024-12-16T03:31:04.16Z",
      "end_time": "2024-12-16T03:31:08.167Z",
      "duration": 4007
    },
    {
      "trace_id": "3dd7bb2600064eea1a595021d77cb3d5",
      "trace_name": "activity.onCreate",
      "thread_name": "main",
      "start_time": "2024-12-16T03:30:57.915Z",
      "end_time": "2024-12-16T03:30:58.195Z",
      "duration": 280
    },
    {
      "trace_id": "097d6c882be5f5ccacc0ef700b17b87a",
      "trace_name": "SampleApp.onCreate",
      "thread_name": "main",
      "start_time": "2024-12-16T03:30:57.712Z",
      "end_time": "2024-12-16T03:30:57.829Z",
      "duration": 117
    },
    {
      "trace_id": "7e5ccd666dc26dbb65f4ce92b543637e",
      "trace_name": "activity.onCreate",
      "thread_name": "main",
      "start_time": "2024-12-16T03:26:48.27Z",
      "end_time": "2024-12-16T03:26:48.351Z",
      "duration": 81
    },
    {
      "trace_id": "b0a9210cb6b5b98773e4ae6d98f65a8c",
      "trace_name": "SampleApp.onCreate",
      "thread_name": "main",
      "start_time": "2024-12-16T03:26:48.18Z",
      "end_time": "2024-12-16T03:26:48.232Z",
      "duration": 52
    }
  ]
}

export const emptyTrace = {
  "app_id": "",
  "trace_id": "",
  "session_id": "",
  "user_id": "",
  "start_time": "",
  "end_time": "",
  "duration": 0,
  "app_version": "",
  "os_version": "",
  "device_model": "",
  "device_manufacturer": "",
  "network_type": "",
  "spans":
    [
      {
        "span_name": "",
        "span_id": "",
        "parent_id": "",
        "status": 0,
        "start_time": "",
        "end_time": "",
        "duration": 0,
        "thread_name": "",
        "user_defined_attributes": null,
        "checkpoints": [
          {
            "name": "",
            "timestamp": ""
          }
        ]
      }
    ]
}

export const emptyAlertPrefs = {
  crash_rate_spike: {
    email: true
  },
  anr_rate_spike: {
    email: true
  },
  launch_time_spike: {
    email: true
  }
}

export const emptyAppSettings = {
  retention_period: 30
}

export const emptyUsage = [
  {
    "app_id": "",
    "app_name": "",
    "monthly_app_usage": [
      {
        "month_year": "",
        "event_count": 0,
        "session_count": 0,
        "trace_count": 0,
        "span_count": 0,
      }
    ]
  }
]

export const emptyBugReportsOverviewResponse = {
  "meta": {
    "next": false,
    "previous": false
  },
  "results": [] as {
    "session_id": string,
    "app_id": string,
    "event_id": string,
    "status": number,
    "description": string
    "timestamp": string
    "attribute": {
      "installation_id": string
      "app_version": string,
      "app_build": string,
      "app_unique_id": string,
      "measure_sdk_version": string,
      "platform": string,
      "thread_name": string,
      "user_id": string,
      "device_name": string,
      "device_model": string,
      "device_manufacturer": string,
      "device_type": string,
      "device_is_foldable": boolean,
      "device_is_physical": boolean,
      "device_density_dpi": number,
      "device_width_px": number,
      "device_height_px": number,
      "device_density": number,
      "device_locale": string,
      "device_low_power_mode": boolean,
      "device_thermal_throttling_enabled": boolean,
      "device_cpu_arch": string,
      "os_name": string,
      "os_version": string,
      "os_page_size": number,
      "network_type": string,
      "network_provider": string,
      "network_generation": string
    },
    "user_defined_attribute": null,
    "attachments": null,
    "matched_free_text": string
  }[]
}

export const emptyBugReport = {
  "session_id": "",
  "app_id": "",
  "event_id": "",
  "status": 0,
  "description": "",
  "timestamp": "",
  "attribute": {
    "installation_id": "",
    "app_version": "",
    "app_build": "",
    "app_unique_id": "",
    "measure_sdk_version": "",
    "platform": "",
    "thread_name": "",
    "user_id": "",
    "device_name": "",
    "device_model": "",
    "device_manufacturer": "",
    "device_type": "",
    "device_is_foldable": false,
    "device_is_physical": false,
    "device_density_dpi": 0,
    "device_width_px": 0,
    "device_height_px": 0,
    "device_density": 0,
    "device_locale": "",
    "device_low_power_mode": false,
    "device_thermal_throttling_enabled": false,
    "device_cpu_arch": "",
    "os_name": "",
    "os_version": "",
    "os_page_size": 0,
    "network_type": "",
    "network_provider": "",
    "network_generation": ""
  },
  "user_defined_attribute": null,
  "attachments": [
    {
      "id": "",
      "name": "",
      "type": "",
      "key": "",
      "location": ""
    }
  ]
}

export class AppVersion {
  name: string;
  code: string;
  displayName: string;

  constructor(name: string, code: string) {
    this.name = name;
    this.code = code;
    this.displayName = this.name + ' (' + this.code + ')'
  }
}

export class OsVersion {
  name: string;
  version: string;
  displayName: string;

  constructor(name: string, version: string) {
    this.name = name;
    this.version = version;
    this.displayName = this.name + ' ' + this.version
  }
}

export type UserDefAttr = {
  key: string
  type: string
}

export const saveListFiltersToServer = async (filters: Filters) => {
  if (filters.versions.length === 0 &&
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

  const origin = process.env.NEXT_PUBLIC_API_BASE_URL
  let url = `${origin}/apps/${filters.app.id}/shortFilters`

  const udExpression = {
    and: filters.udAttrMatchers.map(matcher => ({
      cmp: {
        key: matcher.key,
        type: matcher.type,
        op: matcher.op,
        value: String(matcher.value)
      }
    }))
  };

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
  };

  if (filters.udAttrMatchers.length > 0) {
    bodyFilters.ud_expression = JSON.stringify(udExpression);
  }

  const opts = {
    method: 'POST',
    body: JSON.stringify({
      filters: bodyFilters
    })
  }

  try {
    const res = await fetchMeasure(url, opts);

    if (!res.ok) {
      return null
    }

    const data = await res.json()
    return data.filter_short_code
  } catch {
    return null
  }
}

async function applyGenericFiltersToUrl(url: string, filters: Filters, keyId: string | null, keyTimestamp: string | null, limit: number | null, offset: number | null) {
  const serverFormattedStartDate = formatUserInputDateToServerFormat(filters.startDate)
  const serverFormattedEndDate = formatUserInputDateToServerFormat(filters.endDate)
  const timezone = getTimeZoneForServer()

  const u = new URL(url)
  const searchParams = new URLSearchParams()

  searchParams.append('from', serverFormattedStartDate)
  searchParams.append('to', serverFormattedEndDate)
  searchParams.append('timezone', timezone)

  const filterShortCode = await saveListFiltersToServer(filters)

  if (filterShortCode !== null) {
    searchParams.append('filter_short_code', filterShortCode)
  }

  // Append session type if needed
  if (filters.sessionType === SessionType.Issues) {
    searchParams.append('crash', '1')
    searchParams.append('anr', '1')
  } else if (filters.sessionType === SessionType.Crashes) {
    searchParams.append('crash', '1')
  } else if (filters.sessionType === SessionType.ANRs) {
    searchParams.append('anr', '1')
  }

  // Append span name if needed
  if (filters.rootSpanName !== "") {
    searchParams.append('span_name', encodeURIComponent(filters.rootSpanName))
  }

  // Append span statuses if needed
  if (filters.spanStatuses.length > 0) {
    filters.spanStatuses.forEach((v) => {
      if (v === SpanStatus.Unset) {
        searchParams.append('span_statuses', "0")
      } else if (v === SpanStatus.Ok) {
        searchParams.append('span_statuses', "1")
      } else if (v === SpanStatus.Error) {
        searchParams.append('span_statuses', "2")
      }
    })
  }

  // Append bug report statuses if needed
  if (filters.bugReportStatuses.length > 0) {
    filters.bugReportStatuses.forEach((v) => {
      if (v === BugReportStatus.Open) {
        searchParams.append('bug_report_statuses', "0")
      } else if (v === BugReportStatus.Closed) {
        searchParams.append('bug_report_statuses', "1")
      }
    })
  }

  // Append free text if present
  if (filters.freeText !== '') {
    searchParams.append('free_text', filters.freeText)
  }

  // Append keyId if present
  if (keyId !== null) {
    searchParams.append('key_id', keyId)
  }

  // Append keyTimestamp if present
  if (keyTimestamp !== null) {
    searchParams.append('key_timestamp', keyTimestamp)
  }

  // Append limit if present
  if (limit !== null) {
    searchParams.append('limit', String(limit))
  }

  // Append offset if present
  if (offset !== null) {
    searchParams.append('offset', String(offset))
  }

  u.search = searchParams.toString()

  return u.toString()
}

export const fetchTeamsFromServer = async (router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  try {
    const res = await fetchMeasure(`${origin}/teams`);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: TeamsApiStatus.Error, data: null }
    }

    const data: [{ id: string, name: string }] = await res.json()

    return { status: TeamsApiStatus.Success, data: data }
  } catch {
    return { status: TeamsApiStatus.Cancelled, data: null }
  }
}

export const fetchAppsFromServer = async (teamId: string, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  try {
    const res = await fetchMeasure(`${origin}/teams/${teamId}/apps`);

    if (!res.ok && res.status == 404) {
      return { status: AppsApiStatus.NoApps, data: null }
    }

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: AppsApiStatus.Error, data: null }
    }

    const data = await res.json()
    return { status: AppsApiStatus.Success, data: data }
  } catch {
    return { status: AppsApiStatus.Cancelled, data: null }
  }
}

export const fetchRootSpanNamesFromServer = async (selectedApp: typeof emptyApp, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  try {
    const res = await fetchMeasure(`${origin}/apps/${selectedApp.id}/spans/roots/names`);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
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

export const fetchSpansFromServer = async (filters: Filters, limit: number, offset: number, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  var url = `${origin}/apps/${filters.app.id}/spans?`

  url = await applyGenericFiltersToUrl(url, filters, null, null, limit, offset)

  try {
    const res = await fetchMeasure(url);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: SpansApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: SpansApiStatus.Success, data: data }
  } catch {
    return { status: SpansApiStatus.Cancelled, data: null }
  }
}

export const fetchSpanMetricsPlotFromServer = async (filters: Filters, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  var url = `${origin}/apps/${filters.app.id}/spans/plots/metrics?`

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

  try {
    const res = await fetchMeasure(url);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
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

export const fetchTraceFromServer = async (appId: string, traceId: string, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  try {
    const res = await fetchMeasure(`${origin}/apps/${appId}/traces/${traceId}`);
    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: TraceApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: TraceApiStatus.Success, data: data }
  } catch {
    return { status: TraceApiStatus.Cancelled, data: null }
  }
}

export const fetchFiltersFromServer = async (selectedApp: typeof emptyApp, filtersApiType: FiltersApiType, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  let url = `${origin}/apps/${selectedApp.id}/filters`

  // fetch the user defined attributes
  url += '?ud_attr_keys=1'

  // if filter is for Crashes, Anrs or Spans we append a query param indicating it
  if (filtersApiType === FiltersApiType.Crash) {
    url += '&crash=1'
  } else if (filtersApiType === FiltersApiType.Anr) {
    url += '&anr=1'
  } else if (filtersApiType === FiltersApiType.Span) {
    url += '&span=1'
  }

  try {
    const res = await fetchMeasure(url);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
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

export const fetchJourneyFromServer = async (journeyType: JourneyType, exceptionsGroupdId: string | null, bidirectional: boolean, filters: Filters, router: AppRouterInstance) => {
  // Must pass in exceptionsGroupdId if journey type is crash or anr details
  if ((journeyType === JourneyType.CrashDetails || journeyType === JourneyType.AnrDetails) && exceptionsGroupdId === undefined) {
    return { status: JourneyApiStatus.Error, data: null }
  }

  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  let url = ''
  if (journeyType === JourneyType.CrashDetails) {
    url = `${origin}/apps/${filters.app.id}/crashGroups/${exceptionsGroupdId}/plots/journey?`
  } else if (journeyType === JourneyType.AnrDetails) {
    url = `${origin}/apps/${filters.app.id}/anrGroups/${exceptionsGroupdId}/plots/journey?`
  } else {
    url = `${origin}/apps/${filters.app.id}/journey?`
  }

  // Append bidirectional value
  url = url + `bigraph=${bidirectional ? '1&' : '0&'}`

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

  try {
    const res = await fetchMeasure(url);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: JourneyApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: JourneyApiStatus.Success, data: data }
  } catch {
    return { status: JourneyApiStatus.Cancelled, data: null }
  }
}

export const fetchMetricsFromServer = async (filters: Filters, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  let url = `${origin}/apps/${filters.app.id}/metrics?`

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

  try {
    const res = await fetchMeasure(url);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: MetricsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: MetricsApiStatus.Success, data: data }
  } catch {
    return { status: MetricsApiStatus.Cancelled, data: null }
  }
}

export const fetchSessionsOverviewFromServer = async (filters: Filters, keyId: string | null, keyTimestamp: string | null, limit: number, offset: number, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  var url = `${origin}/apps/${filters.app.id}/sessions?`

  url = await applyGenericFiltersToUrl(url, filters, keyId, keyTimestamp, limit, offset)

  try {
    const res = await fetchMeasure(url);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: SessionsOverviewApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: SessionsOverviewApiStatus.Success, data: data }
  } catch {
    return { status: SessionsOverviewApiStatus.Cancelled, data: null }
  }
}

export const fetchSessionsOverviewPlotFromServer = async (filters: Filters, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  var url = `${origin}/apps/${filters.app.id}/sessions/plots/instances?`

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

  try {
    const res = await fetchMeasure(url);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
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

export const fetchExceptionsOverviewFromServer = async (exceptionsType: ExceptionsType, filters: Filters, keyId: string | null, limit: number, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  var url = ""
  if (exceptionsType === ExceptionsType.Crash) {
    url = `${origin}/apps/${filters.app.id}/crashGroups?`
  } else {
    url = `${origin}/apps/${filters.app.id}/anrGroups?`
  }

  url = await applyGenericFiltersToUrl(url, filters, keyId, null, limit, null)

  try {
    const res = await fetchMeasure(url);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: ExceptionsOverviewApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: ExceptionsOverviewApiStatus.Success, data: data }
  } catch {
    return { status: ExceptionsOverviewApiStatus.Cancelled, data: null }
  }

}

export const fetchExceptionsDetailsFromServer = async (exceptionsType: ExceptionsType, exceptionsGroupdId: string, filters: Filters, keyId: string | null, keyTimestamp: string | null, limit: number, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  var url = ""
  if (exceptionsType === ExceptionsType.Crash) {
    url = `${origin}/apps/${filters.app.id}/crashGroups/${exceptionsGroupdId}/crashes?`
  } else {
    url = `${origin}/apps/${filters.app.id}/anrGroups/${exceptionsGroupdId}/anrs?`
  }

  url = await applyGenericFiltersToUrl(url, filters, keyId, keyTimestamp, limit, null)

  try {
    const res = await fetchMeasure(url);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: ExceptionsDetailsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: ExceptionsDetailsApiStatus.Success, data: data }
  } catch {
    return { status: ExceptionsDetailsApiStatus.Cancelled, data: null }
  }

}

export const fetchExceptionsOverviewPlotFromServer = async (exceptionsType: ExceptionsType, filters: Filters, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  var url = ""
  if (exceptionsType === ExceptionsType.Crash) {
    url = `${origin}/apps/${filters.app.id}/crashGroups/plots/instances?`
  } else {
    url = `${origin}/apps/${filters.app.id}/anrGroups/plots/instances?`
  }

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

  try {
    const res = await fetchMeasure(url);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
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


export const fetchExceptionsDetailsPlotFromServer = async (exceptionsType: ExceptionsType, exceptionsGroupdId: string, filters: Filters, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  var url = ""
  if (exceptionsType === ExceptionsType.Crash) {
    url = `${origin}/apps/${filters.app.id}/crashGroups/${exceptionsGroupdId}/plots/instances?`
  } else {
    url = `${origin}/apps/${filters.app.id}/anrGroups/${exceptionsGroupdId}/plots/instances?`
  }

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

  try {
    const res = await fetchMeasure(url);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
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

export const fetchExceptionsDistributionPlotFromServer = async (exceptionsType: ExceptionsType, exceptionsGroupdId: string, filters: Filters, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  var url = ""
  if (exceptionsType === ExceptionsType.Crash) {
    url = `${origin}/apps/${filters.app.id}/crashGroups/${exceptionsGroupdId}/plots/distribution?`
  } else {
    url = `${origin}/apps/${filters.app.id}/anrGroups/${exceptionsGroupdId}/plots/distribution?`
  }

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

  try {
    const res = await fetchMeasure(url);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: ExceptionsDistributionPlotApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (data === null || Object.values(data).every(value => typeof value === 'object' && value !== null && Object.keys(value).length === 0)) {
      return { status: ExceptionsDistributionPlotApiStatus.NoData, data: null }
    }

    return { status: ExceptionsDistributionPlotApiStatus.Success, data: data }
  } catch {
    return { status: ExceptionsDistributionPlotApiStatus.Cancelled, data: null }
  }
}

export const fetchAuthzAndMembersFromServer = async (teamId: string, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  try {
    const res = await fetchMeasure(`${origin}/teams/${teamId}/authz`);
    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: AuthzAndMembersApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: AuthzAndMembersApiStatus.Success, data: data }
  } catch {
    return { status: AuthzAndMembersApiStatus.Cancelled, data: null }
  }
}

export const fetchSessionTimelineFromServer = async (appId: string, sessionId: string, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  try {
    const res = await fetchMeasure(`${origin}/apps/${appId}/sessions/${sessionId}`);
    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: SessionTimelineApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: SessionTimelineApiStatus.Success, data: data }
  } catch {
    return { status: SessionTimelineApiStatus.Cancelled, data: null }
  }
}

export const changeTeamNameFromServer = async (teamId: string, newTeamName: string, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL
  const opts = {
    method: 'PATCH',
    body: JSON.stringify({ name: newTeamName })
  };

  try {
    const res = await fetchMeasure(`${origin}/teams/${teamId}/rename`, opts);
    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: TeamNameChangeApiStatus.Error }
    }

    return { status: TeamNameChangeApiStatus.Success }
  } catch {
    return { status: TeamNameChangeApiStatus.Cancelled }
  }
}

export const createTeamFromServer = async (teamName: string, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL
  const opts = {
    method: 'POST',
    body: JSON.stringify({ name: teamName })
  };

  try {
    const res = await fetchMeasure(`${origin}/teams`, opts);
    const data = await res.json()

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: CreateTeamApiStatus.Error, error: data.error }
    }

    return { status: CreateTeamApiStatus.Success }
  } catch {
    return { status: CreateTeamApiStatus.Cancelled }
  }
}

export const createAppFromServer = async (teamId: string, appName: string, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL
  const opts = {
    method: 'POST',
    body: JSON.stringify({ name: appName })
  };

  try {
    const res = await fetchMeasure(`${origin}/teams/${teamId}/apps`, opts);
    const data = await res.json()

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: CreateAppApiStatus.Error, error: data.error }
    }

    return { status: CreateAppApiStatus.Success, data: data }
  } catch {
    return { status: CreateAppApiStatus.Cancelled }
  }
}

export const changeRoleFromServer = async (teamId: string, newRole: string, memberId: string, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL
  const opts = {
    method: 'PATCH',
    body: JSON.stringify({ role: newRole.toLocaleLowerCase() })
  };

  try {
    const res = await fetchMeasure(`${origin}/teams/${teamId}/members/${memberId}/role`, opts);
    const data = await res.json()

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: RoleChangeApiStatus.Error, error: data.error }
    }

    return { status: RoleChangeApiStatus.Success }
  } catch {
    return { status: RoleChangeApiStatus.Cancelled }
  }
}

export const inviteMemberFromServer = async (teamId: string, email: string, role: string, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL
  const lowerCaseRole = role.toLocaleLowerCase()
  const opts = {
    method: 'POST',
    headers: {
      "Content-Type": `application/json`,
    },
    body: JSON.stringify([{ email: email, role: lowerCaseRole }])
  };

  try {
    const res = await fetchMeasure(`${origin}/teams/${teamId}/invite`, opts);
    const data = await res.json();

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: InviteMemberApiStatus.Error, error: data.error }
    }

    return { status: InviteMemberApiStatus.Success }
  } catch {
    return { status: InviteMemberApiStatus.Cancelled }
  }
}

export const removeMemberFromServer = async (teamId: string, memberId: string, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL
  const opts = {
    method: 'DELETE',
  };

  try {
    const res = await fetchMeasure(`${origin}/teams/${teamId}/members/${memberId}`, opts);
    const data = await res.json()

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: RemoveMemberApiStatus.Error, error: data.error }
    }

    return { status: RemoveMemberApiStatus.Success }
  } catch {
    return { status: RemoveMemberApiStatus.Cancelled }
  }
}

export const fetchAlertPrefsFromServer = async (appId: string, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  try {
    const res = await fetchMeasure(`${origin}/apps/${appId}/alertPrefs`);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: FetchAlertPrefsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: FetchAlertPrefsApiStatus.Success, data: data }
  } catch {
    return { status: FetchAlertPrefsApiStatus.Cancelled, data: null }
  }
}

export const updateAlertPrefsFromServer = async (appdId: string, alertPrefs: typeof emptyAlertPrefs, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL
  const opts = {
    method: 'PATCH',
    body: JSON.stringify(alertPrefs)
  };

  try {
    const res = await fetchMeasure(`${origin}/apps/${appdId}/alertPrefs`, opts);
    const data = await res.json()

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: UpdateAlertPrefsApiStatus.Error, error: data.error }
    }

    return { status: UpdateAlertPrefsApiStatus.Success }
  } catch {
    return { status: UpdateAlertPrefsApiStatus.Cancelled }
  }
}

export const fetchAppSettingsFromServer = async (appId: string, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  try {
    const res = await fetchMeasure(`${origin}/apps/${appId}/settings`);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: FetchAppSettingsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: FetchAppSettingsApiStatus.Success, data: data }
  } catch {
    return { status: FetchAppSettingsApiStatus.Cancelled, data: null }
  }
}

export const updateAppSettingsFromServer = async (appdId: string, appSettings: typeof emptyAppSettings, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL
  const opts = {
    method: 'PATCH',
    body: JSON.stringify(appSettings)
  };

  try {
    const res = await fetchMeasure(`${origin}/apps/${appdId}/settings`, opts);
    const data = await res.json()

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: UpdateAppSettingsApiStatus.Error, error: data.error }
    }

    return { status: UpdateAppSettingsApiStatus.Success }
  } catch {
    return { status: UpdateAppSettingsApiStatus.Cancelled }
  }
}

export const changeAppNameFromServer = async (appId: string, newAppName: string, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL
  const opts = {
    method: 'PATCH',
    body: JSON.stringify({ name: newAppName })
  };

  try {
    const res = await fetchMeasure(`${origin}/apps/${appId}/rename`, opts);
    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: AppNameChangeApiStatus.Error }
    }

    return { status: AppNameChangeApiStatus.Success }
  } catch {
    return { status: AppNameChangeApiStatus.Cancelled }
  }
}

export const fetchUsageFromServer = async (teamId: string, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  try {
    const res = await fetchMeasure(`${origin}/teams/${teamId}/usage`);

    if (!res.ok && res.status == 404) {
      return { status: FetchUsageApiStatus.NoApps, data: null }
    }

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: FetchUsageApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: FetchUsageApiStatus.Success, data: data }
  } catch {
    return { status: FetchUsageApiStatus.Cancelled, data: null }
  }
}

export const fetchBugReportsOverviewFromServer = async (filters: Filters, limit: number, offset: number, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  var url = `${origin}/apps/${filters.app.id}/bugReports?`

  url = await applyGenericFiltersToUrl(url, filters, null, null, limit, offset)

  try {
    const res = await fetchMeasure(url);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: BugReportsOverviewApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: BugReportsOverviewApiStatus.Success, data: data }
  } catch {
    return { status: BugReportsOverviewApiStatus.Cancelled, data: null }
  }
}

export const fetchBugReportsOverviewPlotFromServer = async (filters: Filters, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  var url = `${origin}/apps/${filters.app.id}/bugReports/plots/instances?`

  url = await applyGenericFiltersToUrl(url, filters, null, null, null, null)

  try {
    const res = await fetchMeasure(url);

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
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

export const fetchBugReportFromServer = async (appId: string, bugReportId: string, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  try {
    const res = await fetchMeasure(`${origin}/apps/${appId}/bugReports/${bugReportId}`);
    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: BugReportApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: BugReportApiStatus.Success, data: data }
  } catch {
    return { status: BugReportApiStatus.Cancelled, data: null }
  }
}

export const updateBugReportStatusFromServer = async (appId: string, bugReportId: string, status: number, router: AppRouterInstance) => {
  const origin = process.env.NEXT_PUBLIC_API_BASE_URL

  const opts = {
    method: 'PATCH',
    body: JSON.stringify({ status: Number(status) })
  };

  try {
    const res = await fetchMeasure(`${origin}/apps/${appId}/bugReports/${bugReportId}`, opts);
    const data = await res.json()

    if (!res.ok) {
      logoutIfAuthError(auth, router, res)
      return { status: UpdateBugReportStatusApiStatus.Error, error: data.error }
    }

    return { status: UpdateBugReportStatusApiStatus.Success }
  } catch {
    return { status: UpdateBugReportStatusApiStatus.Cancelled }
  }
}