"use client"

import { AppsApiStatus, AuthzAndMembersApiStatus, emptyApp, emptyAppSettings, FetchAppSettingsApiStatus, fetchAppSettingsFromServer, fetchAppsFromServer, fetchAuthzAndMembersFromServer, UpdateAppSettingsApiStatus, updateAppSettingsFromServer } from "@/app/api/api_calls";
import CreateApp from "@/app/components/create_app";
import DropdownSelect, { DropdownSelectType } from "@/app/components/dropdown_select";
import { getUserIdOrRedirectToAuth } from "@/app/utils/auth_utils";
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { supabase } from "@/utils/supabase/browser";


export default function Apps({ params }: { params: { teamId: string } }) {
  const router = useRouter()

  const [apps, setApps] = useState([] as typeof emptyApp[]);
  const [appsApiStatus, setAppsApiStatus] = useState(AppsApiStatus.Loading);

  const [currentUserCanChangeAppSettings, setCurrentUserCanChangeAppSettings] = useState(false)

  const [fetchAppSettingsApiStatusMap, setFetchAppSettingsApiStatusMap] = useState<Map<string, FetchAppSettingsApiStatus>>();
  const [updateAppSettingsApiStatusMap, setUpdateAppSettingsApiStatusMap] = useState<Map<string, UpdateAppSettingsApiStatus>>();
  const [appSettingsMap, setAppSettingsMap] = useState<Map<string, typeof emptyAppSettings | null>>();
  const [updateAppSettingsMap, setUpdateAppSettingsMap] = useState<Map<string, typeof emptyAppSettings | null>>();
  const [updateAppSettingsMsgMap, setUpdateAppSettingsMsgMap] = useState<Map<string, string>>();

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

        const resultApps = result.data
        setApps(resultApps)

        const fetchAppSettingsApiStatusMap = new Map<string, FetchAppSettingsApiStatus>()
        const updateAppSettingsApiStatusMap = new Map<string, UpdateAppSettingsApiStatus>()
        const updateAppSettingsMsgMap = new Map<string, string>()

        resultApps.forEach((app: typeof emptyApp) => {
          fetchAppSettingsApiStatusMap.set(app.id, FetchAppSettingsApiStatus.Loading)
          updateAppSettingsApiStatusMap.set(app.id, UpdateAppSettingsApiStatus.Init)
          updateAppSettingsMsgMap.set(app.id, "")
        })

        setFetchAppSettingsApiStatusMap(fetchAppSettingsApiStatusMap)
        setUpdateAppSettingsApiStatusMap(updateAppSettingsApiStatusMap)
        setUpdateAppSettingsMsgMap(updateAppSettingsMsgMap)
        break
    }
  }

  useEffect(() => {
    getApps()
  }, []);

  const getCurrentUserCanChangeAppSettings = async () => {
    const result = await fetchAuthzAndMembersFromServer(params.teamId, router)

    switch (result.status) {
      case AuthzAndMembersApiStatus.Error:
        break
      case AuthzAndMembersApiStatus.Success:
        const currentUserId = await getUserIdOrRedirectToAuth(supabase, router)!
        const currentUserRole = result.data.members.find((member: any) => member.id === currentUserId)!.role
        if (currentUserRole === 'owner' || currentUserRole === 'admin') {
          setCurrentUserCanChangeAppSettings(true)
        } else {
          setCurrentUserCanChangeAppSettings(false)
        }
        break
    }
  }

  useEffect(() => {
    getCurrentUserCanChangeAppSettings()
  }, []);

  const getAppSettings = async () => {
    const fetchAppSettingsApiStatusMap = new Map<string, FetchAppSettingsApiStatus>()
    apps.forEach((app: typeof emptyApp) => {
      fetchAppSettingsApiStatusMap.set(app.id, FetchAppSettingsApiStatus.Loading)
    })
    setFetchAppSettingsApiStatusMap(fetchAppSettingsApiStatusMap)

    const appSettingsMap = new Map<string, typeof emptyAppSettings | null>()

    const promises = apps.map(async (app: typeof emptyApp) => {
      const result = await fetchAppSettingsFromServer(app.id, router);

      switch (result.status) {
        case FetchAppSettingsApiStatus.Error:
          fetchAppSettingsApiStatusMap.set(app.id, FetchAppSettingsApiStatus.Error)
          appSettingsMap.set(app.id, null)
          break;
        case FetchAppSettingsApiStatus.Success:
          fetchAppSettingsApiStatusMap.set(app.id, FetchAppSettingsApiStatus.Success)
          appSettingsMap.set(app.id, result.data)
          break;
      }
    })

    await Promise.all(promises);

    setAppSettingsMap(appSettingsMap)
    setUpdateAppSettingsMap(appSettingsMap)
  }

  useEffect(() => {
    getAppSettings()
  }, [apps]);

  const saveAppSettings = async (appId: string) => {
    const newUpdateAppSettingsApiStatusMap = new Map(updateAppSettingsApiStatusMap)
    newUpdateAppSettingsApiStatusMap.set(appId, UpdateAppSettingsApiStatus.Loading)
    const newUpdateAppSettingsMsgMap = new Map(updateAppSettingsMsgMap)
    newUpdateAppSettingsMsgMap.set(appId, "Saving...")
    setUpdateAppSettingsApiStatusMap(newUpdateAppSettingsApiStatusMap)
    setUpdateAppSettingsMsgMap(newUpdateAppSettingsMsgMap)

    const result = await updateAppSettingsFromServer(appId, updateAppSettingsMap!.get(appId)!, router)

    const resultUpdateAppSettingsApiStatusMap = new Map(newUpdateAppSettingsApiStatusMap)
    const resultUpdateAppSettingsMsgMap = new Map(newUpdateAppSettingsMsgMap)

    switch (result.status) {

      case UpdateAppSettingsApiStatus.Error:
        resultUpdateAppSettingsApiStatusMap.set(appId, UpdateAppSettingsApiStatus.Error)
        resultUpdateAppSettingsMsgMap.set(appId, result.error)
        setUpdateAppSettingsApiStatusMap(resultUpdateAppSettingsApiStatusMap)
        setUpdateAppSettingsMsgMap(resultUpdateAppSettingsMsgMap)
        break
      case UpdateAppSettingsApiStatus.Success:
        resultUpdateAppSettingsApiStatusMap.set(appId, UpdateAppSettingsApiStatus.Success)
        resultUpdateAppSettingsMsgMap.set(appId, "App settings saved!")
        setUpdateAppSettingsApiStatusMap(resultUpdateAppSettingsApiStatusMap)
        setUpdateAppSettingsMsgMap(resultUpdateAppSettingsMsgMap)

        const newAppSettingsMap = new Map(appSettingsMap)
        newAppSettingsMap!.set(appId, updateAppSettingsMap!.get(appId)!)
        setAppSettingsMap(newAppSettingsMap)
        break
    }
  }

  const retentionPeriodToDisplayTextMap = new Map([
    [7, '7 days'],
    [15, '15 days'],
    [30, '1 month'],
    [90, '3 months'],
    [180, '6 months'],
    [365, '1 year']]
  )

  const displayTextToRetentionPeriodMap = new Map([
    ['7 days', 7],
    ['15 days', 15],
    ['1 month', 30],
    ['3 months', 90],
    ['6 months', 180],
    ['1 year', 365]]
  )

  const handleRetentionPeriodChange = (appId: string, newRetentionPeriod: string) => {
    const newUpdateAppSettingsMap = new Map(updateAppSettingsMap)
    newUpdateAppSettingsMap.set(appId, { retention_period: displayTextToRetentionPeriodMap.get(newRetentionPeriod)! })

    const newUpdateAppSettingsMsgMap = new Map(updateAppSettingsMsgMap)
    newUpdateAppSettingsMsgMap.set(appId, "")

    setUpdateAppSettingsMap(newUpdateAppSettingsMap)
    setUpdateAppSettingsMsgMap(newUpdateAppSettingsMsgMap)
  }

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
              <div key={id + 'app-settings-key'} className="flex flex-row items-center">
                <p>Data retention period</p>
                <div className="px-2" />
                {fetchAppSettingsApiStatusMap!.get(id) === FetchAppSettingsApiStatus.Loading && <p>: Loading...</p>}
                {fetchAppSettingsApiStatusMap!.get(id) === FetchAppSettingsApiStatus.Error && <p>: Unable to fetch retention period. Please refresh page to try again.</p>}
                {fetchAppSettingsApiStatusMap!.get(id) === FetchAppSettingsApiStatus.Success && <DropdownSelect type={DropdownSelectType.SingleString} title="Data Retention Period" items={Array.from(retentionPeriodToDisplayTextMap.values())} initialSelected={retentionPeriodToDisplayTextMap.get(appSettingsMap!.get(id)!.retention_period!)!} onChangeSelected={(item) => handleRetentionPeriodChange(id, item as string)} />}
                {fetchAppSettingsApiStatusMap!.get(id) === FetchAppSettingsApiStatus.Success && <button className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4" disabled={!currentUserCanChangeAppSettings || updateAppSettingsApiStatusMap!.get(id) === UpdateAppSettingsApiStatus.Loading || appSettingsMap!.get(id)!.retention_period === updateAppSettingsMap!.get(id)!.retention_period} onClick={() => saveAppSettings(id)}>Save</button>}
                <div className="py-1" />
                {updateAppSettingsApiStatusMap!.get(id) !== UpdateAppSettingsApiStatus.Init && <p className="text-sm font-sans">{updateAppSettingsMsgMap!.get(id)}</p>}
              </div>
              <div key={id + 'app-api-key'} className="flex flex-row items-center">
                <p>API key</p>
                <div className="px-2" />
                <input id={id + 'app-api-key-input'} type="text" readOnly={true} value={api_key.key} className="w-96 border border-black rounded-md outline-none focus-visible:outline-yellow-300 py-2 px-4 font-sans placeholder:text-neutral-400" />
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
