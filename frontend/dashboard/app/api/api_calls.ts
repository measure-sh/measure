import { auth, fetchAuth, logoutIfAuthError } from "@/app/utils/auth/auth";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { JourneyType } from "../components/journey"
import { formatUserInputDateToServerFormat, getTimeZoneForServer } from "../utils/time_utils"
import { Filters } from "../components/filters";

export enum TeamsApiStatus {
    Loading,
    Success,
    Error
}

export enum AppsApiStatus {
    Loading,
    Success,
    Error,
    NoApps
}

export enum FiltersApiStatus {
    Loading,
    Success,
    Error,
    NotOnboarded,
    NoData
}

export enum FiltersApiType {
    All,
    Crash,
    Anr
}

export enum JourneyApiStatus {
    Loading,
    Success,
    Error,
    NoData
}

export enum MetricsApiStatus {
    Loading,
    Success,
    Error
}

export enum SessionsOverviewApiStatus {
    Loading,
    Success,
    Error
}

export enum ExceptionsType {
    Crash,
    Anr
}

export enum ExceptionsOverviewApiStatus {
    Loading,
    Success,
    Error
}

export enum ExceptionsOverviewPlotApiStatus {
    Loading,
    Success,
    Error,
    NoData
}

export enum SessionsOverviewPlotApiStatus {
    Loading,
    Success,
    Error,
    NoData
}

export enum ExceptionsDetailsApiStatus {
    Loading,
    Success,
    Error
}

export enum ExceptionsDetailsPlotApiStatus {
    Loading,
    Success,
    Error,
    NoData
}

export enum CreateTeamApiStatus {
    Init,
    Loading,
    Success,
    Error
}

export enum CreateAppApiStatus {
    Init,
    Loading,
    Success,
    Error
}

export enum TeamNameChangeApiStatus {
    Init,
    Loading,
    Success,
    Error
}

export enum AppNameChangeApiStatus {
    Init,
    Loading,
    Success,
    Error
}

export enum RoleChangeApiStatus {
    Init,
    Loading,
    Success,
    Error
}

export enum InviteMemberApiStatus {
    Init,
    Loading,
    Success,
    Error
}

export enum RemoveMemberApiStatus {
    Init,
    Loading,
    Success,
    Error
}

export enum AuthzAndMembersApiStatus {
    Loading,
    Success,
    Error
}

export enum SessionReplayApiStatus {
    Loading,
    Success,
    Error
}

export enum FetchAlertPrefsApiStatus {
    Loading,
    Success,
    Error
}

export enum UpdateAlertPrefsApiStatus {
    Init,
    Loading,
    Success,
    Error
}

export enum FetchAppSettingsApiStatus {
    Loading,
    Success,
    Error
}

export enum UpdateAppSettingsApiStatus {
    Init,
    Loading,
    Success,
    Error
}

export enum FetchUsageApiStatus {
    Loading,
    Success,
    Error,
    NoApps
}

export enum SessionType {
    All = 'All Sessions',
    Crashes = 'Crash Sessions',
    ANRs = 'ANR Sessions',
    Issues = 'Crash & ANR Sessions'
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

export const emptySessionReplay = {
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
    }
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
                "session_count": 0
            }
        ]
    }
]

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

function applyGenericFiltersToUrl(url: string, filters: Filters, keyId: string | null, keyTimestamp: string | null, limit: number | null) {
    const serverFormattedStartDate = formatUserInputDateToServerFormat(filters.startDate)
    const serverFormattedEndDate = formatUserInputDateToServerFormat(filters.endDate)
    const timezone = getTimeZoneForServer()

    url = url + `from=${serverFormattedStartDate}&to=${serverFormattedEndDate}&timezone=${timezone}`

    // Append versions if present
    if (filters.versions.length > 0) {
        url = url + `&versions=${Array.from(filters.versions).map((v) => v.name).join(',')}`
        url = url + `&version_codes=${Array.from(filters.versions).map((v) => v.code).join(',')}`
    }

    // Append OS versions if present
    if (filters.osVersions.length > 0) {
        url = url + `&os_names=${Array.from(filters.osVersions).map((v) => v.name).join(',')}`
        url = url + `&os_versions=${Array.from(filters.osVersions).map((v) => v.version).join(',')}`
    }

    // Append countries if present
    if (filters.countries.length > 0) {
        url = url + `&countries=${Array.from(filters.countries).join(',')}`
    }

    // Append network providers if present
    if (filters.networkProviders.length > 0) {
        url = url + `&network_providers=${Array.from(filters.networkProviders).join(',')}`
    }

    // Append network types if present
    if (filters.networkTypes.length > 0) {
        url = url + `&network_types=${Array.from(filters.networkTypes).join(',')}`
    }

    // Append network generations if present
    if (filters.networkGenerations.length > 0) {
        url = url + `&network_generations=${Array.from(filters.networkGenerations).join(',')}`
    }

    // Append locales if present
    if (filters.locales.length > 0) {
        url = url + `&locales=${Array.from(filters.locales).join(',')}`
    }

    // Append device manufacturers if present
    if (filters.deviceManufacturers.length > 0) {
        url = url + `&device_manufacturers=${Array.from(filters.deviceManufacturers).join(',')}`
    }

    // Append device names if present
    if (filters.deviceNames.length > 0) {
        url = url + `&device_names=${Array.from(filters.deviceNames).join(',')}`
    }

    // Append session type if needed
    if (filters.sessionType === SessionType.Issues) {
        url = url + `&crash=1&anr=1`
    } else if (filters.sessionType === SessionType.Crashes) {
        url = url + `&crash=1`
    } else if (filters.sessionType === SessionType.ANRs) {
        url = url + `&anr=1`
    }

    // Append free text if present
    if (filters.freeText !== '') {
        url = url + `&free_text=${filters.freeText}`
    }

    // Append keyId if present
    if (keyId !== null) {
        url = url + `&key_id=${keyId}`
    }

    // Append keyTimestamp if present
    if (keyTimestamp !== null) {
        url = url + `&key_timestamp=${keyTimestamp}`
    }

    // Append limit if present
    if (limit !== null) {
        url = url + `&limit=${limit}`
    }

    return url

}

export const fetchTeamsFromServer = async (router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const res = await fetchAuth(`${origin}/teams`);
    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: TeamsApiStatus.Error, data: null }
    }

    const data: [{ id: string, name: string }] = await res.json()

    return { status: TeamsApiStatus.Success, data: data }
}

export const fetchAppsFromServer = async (teamId: string, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const res = await fetchAuth(`${origin}/teams/${teamId}/apps`);

    if (!res.ok && res.status == 404) {
        return { status: AppsApiStatus.NoApps, data: null }
    }

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: AppsApiStatus.Error, data: null }
    }

    const data = await res.json()
    return { status: AppsApiStatus.Success, data: data }
}

export const fetchFiltersFromServer = async (selectedApp: typeof emptyApp, filtersApiType: FiltersApiType, router: AppRouterInstance) => {
    if (!selectedApp.onboarded) {
        return { status: FiltersApiStatus.NotOnboarded, data: null }
    }

    const origin = process.env.NEXT_PUBLIC_API_BASE_URL

    let url = `${origin}/apps/${selectedApp.id}/filters`

    // if filter is for Crashes or Anrs, we append a query param indicating it
    if (filtersApiType === FiltersApiType.Crash) {
        url += '?crash=1'
    } else if (filtersApiType === FiltersApiType.Anr) {
        url += '?anr=1'
    }

    const res = await fetchAuth(url);

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: FiltersApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (data.versions === null) {
        return { status: FiltersApiStatus.NoData, data: null }
    }

    return { status: FiltersApiStatus.Success, data: data }
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

    url = applyGenericFiltersToUrl(url, filters, null, null, null)

    const res = await fetchAuth(url);

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: JourneyApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: JourneyApiStatus.Success, data: data }
}

export const fetchMetricsFromServer = async (filters: Filters, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL

    let url = `${origin}/apps/${filters.app.id}/metrics?`

    url = applyGenericFiltersToUrl(url, filters, null, null, null)

    const res = await fetchAuth(url);

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: MetricsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: MetricsApiStatus.Success, data: data }
}

export const fetchSessionsOverviewFromServer = async (filters: Filters, keyId: string | null, limit: number, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL

    var url = `${origin}/apps/${filters.app.id}/sessions?`

    url = applyGenericFiltersToUrl(url, filters, keyId, null, limit)

    const res = await fetchAuth(url);

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: SessionsOverviewApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: SessionsOverviewApiStatus.Success, data: data }

}

export const fetchSessionsOverviewPlotFromServer = async (filters: Filters, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL

    var url = `${origin}/apps/${filters.app.id}/sessions/plots/instances?`

    url = applyGenericFiltersToUrl(url, filters, null, null, null)

    const res = await fetchAuth(url);

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: SessionsOverviewPlotApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (data === null) {
        return { status: SessionsOverviewPlotApiStatus.NoData, data: null }
    }

    return { status: SessionsOverviewPlotApiStatus.Success, data: data }
}

export const fetchExceptionsOverviewFromServer = async (exceptionsType: ExceptionsType, filters: Filters, keyId: string | null, limit: number, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL

    var url = ""
    if (exceptionsType === ExceptionsType.Crash) {
        url = `${origin}/apps/${filters.app.id}/crashGroups?`
    } else {
        url = `${origin}/apps/${filters.app.id}/anrGroups?`
    }

    url = applyGenericFiltersToUrl(url, filters, keyId, null, limit)

    const res = await fetchAuth(url);

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: ExceptionsOverviewApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: ExceptionsOverviewApiStatus.Success, data: data }

}

export const fetchExceptionsDetailsFromServer = async (exceptionsType: ExceptionsType, exceptionsGroupdId: string, filters: Filters, keyId: string | null, keyTimestamp: string | null, limit: number, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL

    var url = ""
    if (exceptionsType === ExceptionsType.Crash) {
        url = `${origin}/apps/${filters.app.id}/crashGroups/${exceptionsGroupdId}/crashes?`
    } else {
        url = `${origin}/apps/${filters.app.id}/anrGroups/${exceptionsGroupdId}/anrs?`
    }

    url = applyGenericFiltersToUrl(url, filters, keyId, keyTimestamp, limit)

    const res = await fetchAuth(url);

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: ExceptionsDetailsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: ExceptionsDetailsApiStatus.Success, data: data }

}

export const fetchExceptionsOverviewPlotFromServer = async (exceptionsType: ExceptionsType, filters: Filters, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL

    var url = ""
    if (exceptionsType === ExceptionsType.Crash) {
        url = `${origin}/apps/${filters.app.id}/crashGroups/plots/instances?`
    } else {
        url = `${origin}/apps/${filters.app.id}/anrGroups/plots/instances?`
    }

    url = applyGenericFiltersToUrl(url, filters, null, null, null)

    const res = await fetchAuth(url);

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: ExceptionsOverviewPlotApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (data === null) {
        return { status: ExceptionsOverviewPlotApiStatus.NoData, data: null }
    }

    return { status: ExceptionsOverviewPlotApiStatus.Success, data: data }
}


export const fetchExceptionsDetailsPlotFromServer = async (exceptionsType: ExceptionsType, exceptionsGroupdId: string, filters: Filters, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL

    var url = ""
    if (exceptionsType === ExceptionsType.Crash) {
        url = `${origin}/apps/${filters.app.id}/crashGroups/${exceptionsGroupdId}/plots/instances?`
    } else {
        url = `${origin}/apps/${filters.app.id}/anrGroups/${exceptionsGroupdId}/plots/instances?`
    }

    url = applyGenericFiltersToUrl(url, filters, null, null, null)

    const res = await fetchAuth(url);

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: ExceptionsDetailsPlotApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (data === null) {
        return { status: ExceptionsDetailsPlotApiStatus.NoData, data: null }
    }

    return { status: ExceptionsDetailsPlotApiStatus.Success, data: data }
}

export const fetchAuthzAndMembersFromServer = async (teamId: string, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL

    const res = await fetchAuth(`${origin}/teams/${teamId}/authz`);
    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: AuthzAndMembersApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: AuthzAndMembersApiStatus.Success, data: data }
}

export const fetchSessionReplayFromServer = async (appId: string, sessionId: string, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL

    const res = await fetchAuth(`${origin}/apps/${appId}/sessions/${sessionId}`);
    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: SessionReplayApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: SessionReplayApiStatus.Success, data: data }
}

export const changeTeamNameFromServer = async (teamId: string, newTeamName: string, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        method: 'PATCH',
        body: JSON.stringify({ name: newTeamName })
    };

    const res = await fetchAuth(`${origin}/teams/${teamId}/rename`, opts);
    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: TeamNameChangeApiStatus.Error }
    }

    return { status: TeamNameChangeApiStatus.Success }
}

export const createTeamFromServer = async (teamName: string, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        method: 'POST',
        body: JSON.stringify({ name: teamName })
    };

    const res = await fetchAuth(`${origin}/teams`, opts);
    const data = await res.json()

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: CreateTeamApiStatus.Error, error: data.error }
    }

    return { status: CreateTeamApiStatus.Success }
}

export const createAppFromServer = async (teamId: string, appName: string, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        method: 'POST',
        body: JSON.stringify({ name: appName })
    };

    const res = await fetchAuth(`${origin}/teams/${teamId}/apps`, opts);
    const data = await res.json()

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: CreateAppApiStatus.Error, error: data.error }
    }

    return { status: CreateAppApiStatus.Success, data: data }
}

export const changeRoleFromServer = async (teamId: string, newRole: string, memberId: string, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole.toLocaleLowerCase() })
    };

    const res = await fetchAuth(`${origin}/teams/${teamId}/members/${memberId}/role`, opts);
    const data = await res.json()

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: RoleChangeApiStatus.Error, error: data.error }
    }

    return { status: RoleChangeApiStatus.Success }
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

    const res = await fetchAuth(`${origin}/teams/${teamId}/invite`, opts);
    const data = await res.json();

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: InviteMemberApiStatus.Error, error: data.error }
    }

    return { status: InviteMemberApiStatus.Success }
}

export const removeMemberFromServer = async (teamId: string, memberId: string, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        method: 'DELETE',
    };

    const res = await fetchAuth(`${origin}/teams/${teamId}/members/${memberId}`, opts);
    const data = await res.json()

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: RemoveMemberApiStatus.Error, error: data.error }
    }

    return { status: RemoveMemberApiStatus.Success }
}

export const fetchAlertPrefsFromServer = async (appId: string, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const res = await fetchAuth(`${origin}/apps/${appId}/alertPrefs`);

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: FetchAlertPrefsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: FetchAlertPrefsApiStatus.Success, data: data }
}

export const updateAlertPrefsFromServer = async (appdId: string, alertPrefs: typeof emptyAlertPrefs, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        method: 'PATCH',
        body: JSON.stringify(alertPrefs)
    };

    const res = await fetchAuth(`${origin}/apps/${appdId}/alertPrefs`, opts);
    const data = await res.json()

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: UpdateAlertPrefsApiStatus.Error, error: data.error }
    }

    return { status: UpdateAlertPrefsApiStatus.Success }
}

export const fetchAppSettingsFromServer = async (appId: string, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const res = await fetchAuth(`${origin}/apps/${appId}/settings`);

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: FetchAppSettingsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: FetchAppSettingsApiStatus.Success, data: data }
}

export const updateAppSettingsFromServer = async (appdId: string, appSettings: typeof emptyAppSettings, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        method: 'PATCH',
        body: JSON.stringify(appSettings)
    };

    const res = await fetchAuth(`${origin}/apps/${appdId}/settings`, opts);
    const data = await res.json()

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: UpdateAppSettingsApiStatus.Error, error: data.error }
    }

    return { status: UpdateAppSettingsApiStatus.Success }
}

export const changeAppNameFromServer = async (appId: string, newAppName: string, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        method: 'PATCH',
        body: JSON.stringify({ name: newAppName })
    };

    const res = await fetchAuth(`${origin}/apps/${appId}/rename`, opts);
    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: AppNameChangeApiStatus.Error }
    }

    return { status: AppNameChangeApiStatus.Success }
}

export const fetchUsageFromServer = async (teamId: string, router: AppRouterInstance) => {
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const res = await fetchAuth(`${origin}/teams/${teamId}/usage`);

    if (!res.ok && res.status == 404) {
        return { status: FetchUsageApiStatus.NoApps, data: null }
    }

    if (!res.ok) {
        logoutIfAuthError(auth, router, res)
        return { status: FetchUsageApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: FetchUsageApiStatus.Success, data: data }
}