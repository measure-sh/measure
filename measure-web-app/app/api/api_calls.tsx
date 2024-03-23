import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { getAccessTokenOrRedirectToAuth, logoutIfAuthError } from "../utils/auth_utils"

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

export enum JourneyApiStatus {
    Loading,
    Success,
    Error
}

export enum MetricsApiStatus {
    Loading,
    Success,
    Error
}

export enum CrashOrAnrType {
    Crash,
    Anr
}

export enum CrashOrAnrGroupsApiStatus {
    Loading,
    Success,
    Error
}

export enum CrashOrAnrGroupDetailsApiStatus {
    Loading,
    Success,
    Error
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
    "nodes": [
        {
            "id": "",
            "nodeColor": "",
            "issues": {
                "crashes": [],
                "anrs": []
            }
        },
    ],
    "links": [
        {
            "source": "",
            "target": "",
            "value": 0
        },
    ]
}

export const emptyMetrics = {
    "adoption": {
        "all_versions": 0,
        "selected_version": 0,
        "adoption": 0
    },
    "anr_free_sessions": {
        "anr_free_sessions": 0,
        "delta": 0
    },
    "cold_launch": {
        "delta": 0,
        "nan": false,
        "p95": 0
    },
    "crash_free_sessions": {
        "crash_free_sessions": 0,
        "delta": 0
    },
    "hot_launch": {
        "delta": 0,
        "nan": false,
        "p95": 0
    },
    "perceived_anr_free_sessions": {
        "perceived_anr_free_sessions": 0,
        "delta": 0
    },
    "perceived_crash_free_sessions": {
        "perceived_crash_free_sessions": 0,
        "delta": 0
    },
    "sizes": {
        "average_app_size": 0,
        "selected_app_size": 0,
        "delta": 0
    },
    "warm_launch": {
        "delta": 0,
        "nan": true,
        "p95": 0
    }
}

const emptyCrashOrAnrGroup = {
    "id": "",
    "app_id": "",
    "name": "",
    "fingerprint": "",
    "count": 0,
    "percentage_contribution": 0,
    "created_at": "",
    "updated_at": ""
}

export const emptyCrashOrAnrGroupsResponse = {
    "meta": {
        "next": false,
        "previous": false
    },
    "results": [] as typeof emptyCrashOrAnrGroup[]
}

const emptyCrashGroupDetails = {
    "id": "",
    "session_id": "",
    "timestamp": "",
    "type": "",
    "thread_name": "",
    "resource": {
        "device_name": "",
        "device_model": "",
        "device_manufacturer": "",
        "device_type": "",
        "device_is_foldable": false,
        "device_is_physical": true,
        "device_density_dpi": 0,
        "device_width_px": 0,
        "device_height_px": 0,
        "device_density": 0.0,
        "device_locale": "",
        "os_name": "",
        "os_version": "",
        "platform": "",
        "app_version": "",
        "app_build": "",
        "app_unique_id": "",
        "measure_sdk_version": "",
        "network_type": "",
        "network_generation": "",
        "network_provider": ""
    },
    "exceptions": [
        {
            "type": "",
            "message": "",
            "location": "",
            "stacktrace": ""
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

export const emptyCrashGroupDetailsResponse = {
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
    "resource": {
        "device_name": "",
        "device_model": "",
        "device_manufacturer": "",
        "device_type": "",
        "device_is_foldable": false,
        "device_is_physical": true,
        "device_density_dpi": 0,
        "device_width_px": 0,
        "device_height_px": 0,
        "device_density": 0.0,
        "device_locale": "",
        "os_name": "",
        "os_version": "",
        "platform": "",
        "app_version": "",
        "app_build": "",
        "app_unique_id": "",
        "measure_sdk_version": "",
        "network_type": "",
        "network_generation": "",
        "network_provider": ""
    },
    "anrs": [
        {
            "type": "",
            "message": "",
            "location": "",
            "stacktrace": ""
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

export const emptyAnrGroupDetailsResponse = {
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
    "app_id": "",
    "cpu_usage": [
        {
            "timestamp": "",
            "value": 0
        },
        {
            "timestamp": "",
            "value": 0
        }
    ],
    "memory_usage": [
        {
            "java_max_heap": 0,
            "java_total_heap": 0,
            "java_free_heap": 0,
            "total_pss": 0,
            "rss": 0,
            "native_total_heap": 0,
            "native_free_heap": 0,
            "interval_config": 0,
            "timestamp": ""
        }
    ],
    "resource": {
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
        "platform": "",
        "app_version": "",
        "app_build": "",
        "app_unique_id": "",
        "measure_sdk_version": "",
        "network_type": "",
        "network_generation": "",
        "network_provider": ""
    },
    "session_id": "",
    "duration": "",
    "threads": {
        "thread_1": [
            {
                "event_type": "http",
                "url": "",
                "method": "",
                "status_code": 0,
                "request_body_size": 0,
                "response_body_size": 0,
                "request_timestamp": "",
                "response_timestamp": "",
                "start_time": 0,
                "end_time": 0,
                "dns_start": 0,
                "dns_end": 0,
                "connect_start": 0,
                "connect_end": 0,
                "request_start": 0,
                "request_end": 0,
                "request_headers_start": 0,
                "request_headers_end": 0,
                "request_body_start": 0,
                "request_body_end": 0,
                "response_start": 0,
                "response_end": 0,
                "response_headers_start": 0,
                "response_headers_end": 0,
                "response_body_start": 0,
                "response_body_end": 0,
                "request_headers_size": 0,
                "response_headers_size": 0,
                "failure_reason": "",
                "failure_description": "",
                "request_headers": {
                    "accept-encoding": "0",
                    "authorization": "",
                    "connection": "",
                    "content-type": "",
                    "host": "",
                    "transfer-encoding": "",
                    "user-agent": ""
                },
                "response_headers": {
                    "content-length": "0",
                    "date": ""
                },
                "client": "",
                "timestamp": "",
                "attributes": {}
            }
        ],
        "main": [
            {
                "event_type": "lifecycle_activity",
                "type": "",
                "class_name": "",
                "intent": "",
                "saved_instance_state": false,
                "timestamp": "",
                "attributes": {}
            },
            {
                "event_type": "lifecycle_app",
                "type": "",
                "timestamp": "",
                "attributes": {}
            },
            {
                "event_type": "cold_launch",
                "process_start_uptime": 0,
                "process_start_requested_uptime": 0,
                "content_provider_attach_uptime": 0,
                "on_next_draw_uptime": 0,
                "launched_activity": "sh.measure.sample.ExceptionDemoActivity",
                "has_saved_state": false,
                "intent_data": "",
                "timestamp": "",
                "attributes": {}
            },
            {
                "event_type": "gesture_click",
                "target": "",
                "target_id": "",
                "touch_down_time": 0,
                "touch_up_time": 0,
                "width": 0,
                "height": 0,
                "x": 0.0,
                "y": 0.0,
                "timestamp": "",
                "attributes": {}
            },
            {
                "event_type": "exception",
                "type": "",
                "location": "",
                "message": "",
                "thread_name": "",
                "handled": false,
                "network_type": "",
                "network_provider": "",
                "network_generation": "",
                "device_locale": "",
                "timestamp": "",
                "attributes": {}
            }
        ],
        "measure-thread-#0": [
            {
                "event_type": "app_exit",
                "reason": "",
                "importance": "",
                "trace": "",
                "process_name": "",
                "pid": "",
                "timestamp": "",
                "attributes": {}
            }
        ]
    }
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

export const fetchTeamsFromServer = async (router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        headers: {
            "Authorization": `Bearer ${authToken}`
        }
    };

    const res = await fetch(`${origin}/teams`, opts);
    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: TeamsApiStatus.Error, data: null }
    }

    const data: [{ id: string, name: string }] = await res.json()

    return { status: TeamsApiStatus.Success, data: data }
}

export const fetchAppsFromServer = async (teamId: string, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        headers: {
            "Authorization": `Bearer ${authToken}`
        }
    };

    const res = await fetch(`${origin}/teams/${teamId}/apps`, opts);

    if (!res.ok && res.status == 404) {
        return { status: AppsApiStatus.NoApps, data: null }
    }

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: AppsApiStatus.Error, data: null }
    }

    const data = await res.json()
    return { status: AppsApiStatus.Success, data: data }
}

export const fetchFiltersFromServer = async (selectedApp: typeof emptyApp, router: AppRouterInstance) => {
    if (!selectedApp.onboarded) {
        return { status: FiltersApiStatus.NotOnboarded, data: null }
    }

    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        headers: {
            "Authorization": `Bearer ${authToken}`
        }
    };

    const res = await fetch(`${origin}/apps/${selectedApp.id}/filters`, opts);

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: FiltersApiStatus.Error, data: null }
    }

    const data = await res.json()

    if (data.versions === null) {
        return { status: FiltersApiStatus.NoData, data: null }
    }

    return { status: FiltersApiStatus.Success, data: data }
}

export const fetchJourneyFromServer = async (appId: string, startDate: string, endDate: string, appVersion: AppVersion, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        headers: {
            "Authorization": `Bearer ${authToken}`
        }
    };

    const serverFormattedStartDate = new Date(startDate).toISOString()
    const serverFormattedEndDate = new Date(endDate).toISOString()
    const res = await fetch(`${origin}/apps/${appId}/journey?version=${appVersion.name}&version_code=${appVersion.code}&from=${serverFormattedStartDate}&to=${serverFormattedEndDate}`, opts);

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: JourneyApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: JourneyApiStatus.Success, data: data }
}

export const fetchMetricsFromServer = async (appId: string, startDate: string, endDate: string, appVersion: AppVersion, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        headers: {
            "Authorization": `Bearer ${authToken}`
        }
    };

    const serverFormattedStartDate = new Date(startDate).toISOString()
    const serverFormattedEndDate = new Date(endDate).toISOString()
    const res = await fetch(`${origin}/apps/${appId}/metrics?versions=${appVersion.name}&version_codes=${appVersion.code}&from=${serverFormattedStartDate}&to=${serverFormattedEndDate}`, opts);

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: MetricsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: MetricsApiStatus.Success, data: data }
}

export const fetchCrashOrAnrGroupsFromServer = async (crashOrAnrType: CrashOrAnrType, appId: string, startDate: string, endDate: string, appVersions: AppVersion[], keyId: string | null, limit: number, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        headers: {
            "Authorization": `Bearer ${authToken}`
        }
    };

    const serverFormattedStartDate = new Date(startDate).toISOString()
    const serverFormattedEndDate = new Date(endDate).toISOString()

    var url = ""
    if (crashOrAnrType === CrashOrAnrType.Crash) {
        url = `${origin}/apps/${appId}/crashGroups?from=${serverFormattedStartDate}&to=${serverFormattedEndDate}&limit=${limit}`
    } else {
        url = `${origin}/apps/${appId}/anrGroups?from=${serverFormattedStartDate}&to=${serverFormattedEndDate}&limit=${limit}`
    }

    // Append versions if present
    if (appVersions.length > 0) {
        url = url + `&versions=${Array.from(appVersions).map((v) => v.name).join(',')}`
        url = url + `&version_codes=${Array.from(appVersions).map((v) => v.code).join(',')}`
    }

    // Append keyId if present
    if (keyId !== null) {
        url = url + `&key_id=${keyId}`
    }

    const res = await fetch(url, opts);

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: CrashOrAnrGroupsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: CrashOrAnrGroupsApiStatus.Success, data: data }

}

export const fetchCrashOrAnrGroupDetailsFromServer = async (crashOrAnrType: CrashOrAnrType, appId: string, crashOrAnrGroupId: string, startDate: string, endDate: string, appVersions: AppVersion[], countries: string[], networkProviders: string[], networkTypes: string[], networkGenerations: string[], locales: string[], deviceManufacturers: string[], deviceNames: string[], keyId: string | null, keyTimestamp: string | null, limit: number, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        headers: {
            "Authorization": `Bearer ${authToken}`
        }
    };

    const serverFormattedStartDate = new Date(startDate).toISOString()
    const serverFormattedEndDate = new Date(endDate).toISOString()

    var url = ""
    if (crashOrAnrType === CrashOrAnrType.Crash) {
        url = `${origin}/apps/${appId}/crashGroups/${crashOrAnrGroupId}/crashes?from=${serverFormattedStartDate}&to=${serverFormattedEndDate}&limit=${limit}`
    } else {
        url = `${origin}/apps/${appId}/anrGroups/${crashOrAnrGroupId}/anrs?from=${serverFormattedStartDate}&to=${serverFormattedEndDate}&limit=${limit}`
    }

    // Append versions if present
    if (appVersions.length > 0) {
        url = url + `&versions=${Array.from(appVersions).map((v) => v.name).join(',')}`
        url = url + `&version_codes=${Array.from(appVersions).map((v) => v.code).join(',')}`
    }

    // Append countries if present
    if (countries.length > 0) {
        url = url + `&countries=${Array.from(countries).join(',')}`
    }

    // Append network providers if present
    if (networkProviders.length > 0) {
        url = url + `&network_providers=${Array.from(networkProviders).join(',')}`
    }

    // Append network types if present
    if (networkTypes.length > 0) {
        url = url + `&network_types=${Array.from(networkTypes).join(',')}`
    }

    // Append network generations if present
    if (networkGenerations.length > 0) {
        url = url + `&network_generations=${Array.from(networkGenerations).join(',')}`
    }

    // Append locales if present
    if (locales.length > 0) {
        url = url + `&locales=${Array.from(locales).join(',')}`
    }

    // Append device manufacturers if present
    if (deviceManufacturers.length > 0) {
        url = url + `&device_manufacturers=${Array.from(deviceManufacturers).join(',')}`
    }

    // Append device names if present
    if (deviceNames.length > 0) {
        url = url + `&device_names=${Array.from(deviceNames).join(',')}`
    }

    // Append keyId if present
    if (keyId !== null) {
        url = url + `&key_id=${keyId}`
    }

    // Append keyTimestamp if present
    if (keyTimestamp !== null) {
        url = url + `&key_timestamp=${keyTimestamp}`
    }

    const res = await fetch(url, opts);

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: CrashOrAnrGroupDetailsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: CrashOrAnrGroupDetailsApiStatus.Success, data: data }

}

export const fetchAuthzAndMembersFromServer = async (teamId: string, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        headers: {
            "Authorization": `Bearer ${authToken}`
        }
    };

    const res = await fetch(`${origin}/teams/${teamId}/authz`, opts);
    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: AuthzAndMembersApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: AuthzAndMembersApiStatus.Success, data: data }
}

export const fetchSessionReplayFromServer = async (appId: string, sessionId: string, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        headers: {
            "Authorization": `Bearer ${authToken}`
        }
    };

    const res = await fetch(`${origin}/apps/${appId}/sessions/${sessionId}`, opts);
    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: SessionReplayApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: SessionReplayApiStatus.Success, data: data }
}

export const changeTeamNameFromServer = async (teamId: string, newTeamName: string, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        method: 'PATCH',
        headers: {
            "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ name: newTeamName })
    };

    const res = await fetch(`${origin}/teams/${teamId}/rename`, opts);
    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: TeamNameChangeApiStatus.Error }
    }

    return { status: TeamNameChangeApiStatus.Success }
}

export const createTeamFromServer = async (teamName: string, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ name: teamName })
    };

    const res = await fetch(`${origin}/teams`, opts);
    const data = await res.json()

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: CreateTeamApiStatus.Error, error: data.error }
    }

    return { status: CreateTeamApiStatus.Success }
}

export const createAppFromServer = async (teamId: string, appName: string, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ name: appName })
    };

    const res = await fetch(`${origin}/teams/${teamId}/apps`, opts);
    const data = await res.json()

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: CreateAppApiStatus.Error, error: data.error }
    }

    return { status: CreateAppApiStatus.Success, data: data }
}

export const changeRoleFromServer = async (teamId: string, newRole: string, memberId: string, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        method: 'PATCH',
        headers: {
            "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ role: newRole.toLocaleLowerCase() })
    };

    const res = await fetch(`${origin}/teams/${teamId}/members/${memberId}/role`, opts);
    const data = await res.json()

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: RoleChangeApiStatus.Error, error: data.error }
    }

    return { status: RoleChangeApiStatus.Success }
}

export const inviteMemberFromServer = async (teamId: string, email: string, role: string, router: AppRouterInstance) => {
    const lowerCaseRole = role.toLocaleLowerCase()
    const opts = {
        method: 'POST',
        headers: {
            "Content-Type": `application/json`,
        },
        body: JSON.stringify({ teamId: teamId, email: email, role: lowerCaseRole })
    };

    const res = await fetch(`/auth/invite`, opts);
    const data = await res.json()

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: InviteMemberApiStatus.Error, error: data.error }
    }

    return { status: InviteMemberApiStatus.Success }
}

export const removeMemberFromServer = async (teamId: string, memberId: string, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        method: 'DELETE',
        headers: {
            "Authorization": `Bearer ${authToken}`
        },
    };

    const res = await fetch(`${origin}/teams/${teamId}/members/${memberId}`, opts);
    const data = await res.json()

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: RemoveMemberApiStatus.Error, error: data.error }
    }

    return { status: RemoveMemberApiStatus.Success }
}