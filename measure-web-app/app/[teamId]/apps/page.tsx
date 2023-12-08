"use client"

import CreateApp from "@/app/components/create_app";
import { getAccessTokenOrRedirectToAuth, logoutIfAuthError } from "@/app/utils/auth_utils";
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';


export default function Apps({ params }: { params: { teamId: string } }) {
  const router = useRouter()

  enum AppsApiStatus {
    Loading,
    Success,
    Error,
    NoApps
  }

  const emptyApp = {
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

  const [apps, setApps] = useState([] as typeof emptyApp[]);
  const [appsApiStatus, setAppsApiStatus] = useState(AppsApiStatus.Loading);

  const getApps = async (teamId: string,) => {
    setAppsApiStatus(AppsApiStatus.Loading)

    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
      headers: {
        "Authorization": `Bearer ${authToken}`
      }
    };

    const res = await fetch(`${origin}/teams/${teamId}/apps`, opts);

    if (!res.ok && res.status == 404) {
      setAppsApiStatus(AppsApiStatus.NoApps)
      return
    }

    if (!res.ok) {
      setAppsApiStatus(AppsApiStatus.Error)
      logoutIfAuthError(router, res)
      return
    }

    const data = await res.json()

    setApps(data)
    setAppsApiStatus(AppsApiStatus.Success)
  }

  useEffect(() => {
    getApps(params.teamId)
  }, []);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-4xl max-w-6xl text-center">Apps</p>
      <div className="py-4" />
      {/* Loading message for apps */}
      {appsApiStatus === AppsApiStatus.Loading && <p className="text-lg font-display">Updating Apps...</p>}

      {/* Error message for apps fetch error */}
      {appsApiStatus === AppsApiStatus.Error && <p className="text-lg font-display">Error fetching apps, please refresh page to try again</p>}

      {/* Show list of apps if app fetch succeeds */}
      {appsApiStatus === AppsApiStatus.Success &&
        <div>
          {apps.map(({ id, name, unique_identifier, platform, api_key, created_at }) => (
            <div key={id + 'app-details'} className="font-sans">
              <div className="flex flex-col">
                <p className="text-xl font-semibold">{name}</p>
                <div className="py-1" />
                <p>Package name: {unique_identifier}</p>
                <div className="py-1" />
                <p>Platform: {platform}</p>
                <div className="py-1" />
                <p>Created at: {created_at}</p>
              </div>
              <div key={id + 'app-api-key'} className="flex flex-row items-center">
                <p>API key</p>
                <div className="px-2" />
                <input id="api-key-input" type="text" value={api_key.key} className="w-96 border border-black rounded-md outline-none focus-visible:outline-yellow-300 py-2 px-4 font-sans placeholder:text-neutral-400" />
                <button className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4" onClick={() => navigator.clipboard.writeText(api_key.key)}>Copy</button>
              </div>
              <div className="py-8" />
            </div>
          ))}
          <div className="w-full border border-black h-0" />
          <div className="py-4" />
        </div>
      }

      {/* Show no apps message when no apps exist */}
      {appsApiStatus === AppsApiStatus.NoApps && <p className="text-lg font-display">Looks like you don&apos;t have any apps yet. Get started by creating your first app!</p>}

      <div className="py-4" />
      <CreateApp teamId={params.teamId} />
    </div>
  )
}
