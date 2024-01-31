"use client"

import { AppsApiStatus, emptyApp, fetchAppsFromServer } from "@/app/api/api_calls";
import CreateApp from "@/app/components/create_app";
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';


export default function Apps({ params }: { params: { teamId: string } }) {
  const router = useRouter()

  const [apps, setApps] = useState([] as typeof emptyApp[]);
  const [appsApiStatus, setAppsApiStatus] = useState(AppsApiStatus.Loading);

  const getApps = async () => {
    setAppsApiStatus(AppsApiStatus.Loading)

    const result = await fetchAppsFromServer(params.teamId, router)

    switch (result.status) {
      case AppsApiStatus.NoApps:
        setAppsApiStatus(AppsApiStatus.NoApps)
        break
      case AppsApiStatus.Error:
        setAppsApiStatus(AppsApiStatus.Error)
        break
      case AppsApiStatus.Success:
        setAppsApiStatus(AppsApiStatus.Success)
        setApps(result.data)
        break
    }
  }

  useEffect(() => {
    getApps()
  }, []);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-4xl max-w-6xl text-center">Apps</p>
      <div className="py-4" />
      {/* Error states for apps fetch */}
      {appsApiStatus === AppsApiStatus.Error && <p className="text-lg font-display">Error fetching apps, please check if Team ID is valid or refresh page to try again</p>}
      {appsApiStatus === AppsApiStatus.NoApps && <p className="text-lg font-display">Looks like you don&apos;t have any apps yet. Get started by creating your first app!</p>}

      {/* Main UI*/}
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

      <div className="py-4" />
      <CreateApp teamId={params.teamId} />
    </div>
  )
}
