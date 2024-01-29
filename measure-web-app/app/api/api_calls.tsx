import { AppRouterInstance } from "next/dist/shared/lib/app-router-context"
import { getAccessTokenOrRedirectToAuth, logoutIfAuthError } from "../utils/auth_utils"
import { versions } from "process"

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

export const emptyCrashGroup = {
    "id": "",
    "app_id": "",
    "app_version": "",
    "name": "",
    "fingerprint": "",
    "count": 0,
    "events": [
        ""
    ],
    "percentage_contribution": 0,
    "created_at": "",
    "updated_at": ""
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

export const fetchCrashGroupsFromServer = async (appId: string, startDate: string, endDate: string, appVersions: string[], router: AppRouterInstance) => {
    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
        headers: {
            "Authorization": `Bearer ${authToken}`
        }
    };

    const serverFormattedStartDate = new Date(startDate).toISOString()
    const serverFormattedEndDate = new Date(endDate).toISOString()

    // If no versions are selected, don't use versions in query params
    var crashGroupsApiUrl = ""
    if (appVersions.length > 0) {
        crashGroupsApiUrl = `${origin}/apps/${appId}/crashGroups?from=${serverFormattedStartDate}&to=${serverFormattedEndDate}&versions=${Array.from(appVersions).join(', ')}`
    } else {
        crashGroupsApiUrl = `${origin}/apps/${appId}/crashGroups?from=${serverFormattedStartDate}&to=${serverFormattedEndDate}`
    }

    const res = await fetch(crashGroupsApiUrl, opts);

    if (!res.ok) {
        logoutIfAuthError(router, res)
        return { status: CrashGroupsApiStatus.Error, data: null }
    }

    const data = await res.json()

    return { status: CrashGroupsApiStatus.Success, data: data }

}