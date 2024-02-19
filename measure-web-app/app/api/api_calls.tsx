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

export enum CrashGroupsApiStatus {
    Loading,
    Success,
    Error
}

export enum CrashDetailsApiStatus {
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
    ]
}

export const emptyMetrics = {
    "adoption": {
        "users": 0,
        "totalUsers": 0,
        "value": 0
    },
    "app_size": {
        "value": 0,
        "delta": 0
    },
    "crash_free_users": {
        "value": 0,
        "delta": 0
    },
    "perceived_crash_free_users": {
        "value": 0,
        "delta": 0
    },
    "multiple_crash_free_users": {
        "value": 0,
        "delta": 0
    },
    "anr_free_users": {
        "value": 0,
        "delta": 0
    },
    "perceived_anr_free_users": {
        "value": 0,
        "delta": 0
    },
    "multiple_anr_free_users": {
        "value": 0,
        "delta": 0
    },
    "app_cold_launch": {
        "value": 0,
        "delta": 0
    },
    "app_warm_launch": {
        "value": 0,
        "delta": 0
    },
    "app_hot_launch": {
        "value": 0,
        "delta": 0
    }
}

const emptyCrashGroup = {
    "id": "",
    "app_id": "",
    "name": "",
    "fingerprint": "",
    "count": 0,
    "percentage_contribution": 0,
    "created_at": "",
    "updated_at": ""
}

export const emptyCrashGroupsResponse = {
    "meta": {
        "next": false,
        "previous": false
    },
    "results": [] as typeof emptyCrashGroup[]
}

const emptyCrashDetail = {
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

export const emptyCrashDetailsResponse = {
    "meta": {
        "next": true,
        "previous": false
    },
    "results": [] as typeof emptyCrashDetail[]
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

export const fetchJourneyFromServer = async (appId: string, startDate: string, endDate: string, appVersion: string, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        headers: {
            "Authorization": `Bearer ${authToken}`
        }
    };

    const serverFormattedStartDate = new Date(startDate).toISOString()
    const serverFormattedEndDate = new Date(endDate).toISOString()
    const res = await fetch(`${origin}/apps/${appId}/journey?version=${appVersion}&from=${serverFormattedStartDate}&to=${serverFormattedEndDate}`, opts);

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: JourneyApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: JourneyApiStatus.Success, data: data }
}

export const fetchMetricsFromServer = async (appId: string, startDate: string, endDate: string, appVersion: string, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        headers: {
            "Authorization": `Bearer ${authToken}`
        }
    };

    const serverFormattedStartDate = new Date(startDate).toISOString()
    const serverFormattedEndDate = new Date(endDate).toISOString()
    const res = await fetch(`${origin}/apps/${appId}/metrics?version=${appVersion}&from=${serverFormattedStartDate}&to=${serverFormattedEndDate}`, opts);

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: MetricsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: MetricsApiStatus.Success, data: data }
}

export const fetchCrashGroupsFromServer = async (appId: string, startDate: string, endDate: string, appVersions: string[], keyId: string | null, limit: number, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        headers: {
            "Authorization": `Bearer ${authToken}`
        }
    };

    const serverFormattedStartDate = new Date(startDate).toISOString()
    const serverFormattedEndDate = new Date(endDate).toISOString()

    var crashGroupsApiUrl = `${origin}/apps/${appId}/crashGroups?from=${serverFormattedStartDate}&to=${serverFormattedEndDate}&limit=${limit}`

    // Append versions if present
    if (appVersions.length > 0) {
        crashGroupsApiUrl = crashGroupsApiUrl + `&versions=${Array.from(appVersions).join(',')}`
    }

    // Append keyId if present
    if (keyId !== null) {
        crashGroupsApiUrl = crashGroupsApiUrl + `&key_id=${keyId}`
    }

    const res = await fetch(crashGroupsApiUrl, opts);

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: CrashGroupsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: CrashGroupsApiStatus.Success, data: data }

}

export const fetchCrashDetailsFromServer = async (appId: string, crashGroupId: string, startDate: string, endDate: string, appVersions: string[], countries: string[], networkProviders: string[], networkTypes: string[], networkGenerations: string[], locales: string[], deviceManufacturers: string[], deviceNames: string[], keyId: string | null, keyTimestamp: string | null, limit: number, router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        headers: {
            "Authorization": `Bearer ${authToken}`
        }
    };

    const serverFormattedStartDate = new Date(startDate).toISOString()
    const serverFormattedEndDate = new Date(endDate).toISOString()

    var crashDetailsApiUrl = `${origin}/apps/${appId}/crashGroups/${crashGroupId}/crashes?from=${serverFormattedStartDate}&to=${serverFormattedEndDate}&limit=${limit}`

    // Append versions if present
    if (appVersions.length > 0) {
        crashDetailsApiUrl = crashDetailsApiUrl + `&versions=${Array.from(appVersions).join(',')}`
    }

    // Append countries if present
    if (countries.length > 0) {
        crashDetailsApiUrl = crashDetailsApiUrl + `&countries=${Array.from(countries).join(',')}`
    }

    // Append network providers if present
    if (networkProviders.length > 0) {
        crashDetailsApiUrl = crashDetailsApiUrl + `&network_providers=${Array.from(networkProviders).join(',')}`
    }

    // Append network types if present
    if (networkTypes.length > 0) {
        crashDetailsApiUrl = crashDetailsApiUrl + `&network_types=${Array.from(networkTypes).join(',')}`
    }

    // Append network generations if present
    if (networkGenerations.length > 0) {
        crashDetailsApiUrl = crashDetailsApiUrl + `&network_generations=${Array.from(networkGenerations).join(',')}`
    }

    // Append locales if present
    if (locales.length > 0) {
        crashDetailsApiUrl = crashDetailsApiUrl + `&locales=${Array.from(locales).join(',')}`
    }

    // Append device manufacturers if present
    if (deviceManufacturers.length > 0) {
        crashDetailsApiUrl = crashDetailsApiUrl + `&device_manufacturers=${Array.from(deviceManufacturers).join(',')}`
    }

    // Append device names if present
    if (deviceNames.length > 0) {
        crashDetailsApiUrl = crashDetailsApiUrl + `&device_names=${Array.from(deviceNames).join(',')}`
    }

    // Append keyId if present
    if (keyId !== null) {
        crashDetailsApiUrl = crashDetailsApiUrl + `&key_id=${keyId}`
    }

    // Append keyTimestamp if present
    if (keyTimestamp !== null) {
        crashDetailsApiUrl = crashDetailsApiUrl + `&key_timestamp=${keyTimestamp}`
    }

    const res = await fetch(crashDetailsApiUrl, opts);

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: CrashDetailsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: CrashDetailsApiStatus.Success, data: data }

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