import { AppRouterInstance } from "next/dist/shared/lib/app-router-context"
import { getAccessTokenOrRedirectToAuth, logoutIfAuthError } from "../utils/auth_utils"

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