"use client"

import { AppNameChangeApiStatus, AuthzAndMembersApiStatus, changeAppNameFromServer, emptyAppSettings, FetchAppSettingsApiStatus, fetchAppSettingsFromServer, fetchAuthzAndMembersFromServer, FiltersApiType, UpdateAppSettingsApiStatus, updateAppSettingsFromServer } from "@/app/api/api_calls";
import CreateApp from "@/app/components/create_app";
import DangerConfirmationModal from "@/app/components/danger_confirmation_modal";
import DropdownSelect, { DropdownSelectType } from "@/app/components/dropdown_select";
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from "@/app/components/filters";
import { auth, getUserIdOrRedirectToAuth } from "@/app/utils/auth/auth";
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils";
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';

export default function Apps({ params }: { params: { teamId: string } }) {
  const router = useRouter()

  const [filters, setFilters] = useState(defaultFilters);

  const [currentUserCanChangeAppSettings, setCurrentUserCanChangeAppSettings] = useState(false)

  const [fetchAppSettingsApiStatus, setFetchAppSettingsApiStatus] = useState(FetchAppSettingsApiStatus.Loading);
  const [updateAppSettingsApiStatus, setUpdateAppSettingsApiStatus] = useState(UpdateAppSettingsApiStatus.Init);
  const [appSettings, setAppSettings] = useState(emptyAppSettings);
  const [updatedAppSettings, setUpdatedAppSettings] = useState(emptyAppSettings);
  const [updateAppSettingsMsg, setUpdateAppSettingsMsg] = useState('');

  const [saveAppNameButtonDisabled, setSaveAppNameButtonDisabled] = useState(true);

  const [appNameConfirmationModalOpen, setAppNameConfirmationModalOpen] = useState(false)
  const [appNameChangeApiStatus, setAppNameChangeApiStatus] = useState(AppNameChangeApiStatus.Init);
  const [appName, setAppName] = useState('')

  const getCurrentUserCanChangeAppSettings = async () => {
    const result = await fetchAuthzAndMembersFromServer(params.teamId, router)

    switch (result.status) {
      case AuthzAndMembersApiStatus.Error:
        break
      case AuthzAndMembersApiStatus.Success:
        const currentUserId = await getUserIdOrRedirectToAuth(auth, router)!
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
  }, [params.teamId]);

  const getAppSettings = async () => {
    setFetchAppSettingsApiStatus(FetchAppSettingsApiStatus.Loading)

    const result = await fetchAppSettingsFromServer(filters.app.id, router);

    switch (result.status) {
      case FetchAppSettingsApiStatus.Error:
        setFetchAppSettingsApiStatus(FetchAppSettingsApiStatus.Error)
        break;
      case FetchAppSettingsApiStatus.Success:
        setFetchAppSettingsApiStatus(FetchAppSettingsApiStatus.Success)
        setAppSettings(result.data)
        break;
    }
  }

  useEffect(() => {
    // Don't try to fetch settings if selected app is not yet set
    if (!filters.ready) {
      return
    }

    setAppName(filters.app.name)
    getAppSettings()
  }, [filters]);

  const saveAppSettings = async () => {
    setUpdateAppSettingsApiStatus(UpdateAppSettingsApiStatus.Loading)
    setUpdateAppSettingsMsg("Saving...")

    const result = await updateAppSettingsFromServer(filters.app.id, updatedAppSettings, router)

    switch (result.status) {

      case UpdateAppSettingsApiStatus.Error:
        setUpdateAppSettingsApiStatus(UpdateAppSettingsApiStatus.Error)
        setUpdateAppSettingsMsg(result.error)
        break
      case UpdateAppSettingsApiStatus.Success:
        setUpdateAppSettingsApiStatus(UpdateAppSettingsApiStatus.Error)
        setUpdateAppSettingsMsg("App settings saved!")
        setAppSettings(updatedAppSettings)
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

  const handleRetentionPeriodChange = (newRetentionPeriod: string) => {
    setUpdatedAppSettings({ retention_period: displayTextToRetentionPeriodMap.get(newRetentionPeriod)! })
    setUpdateAppSettingsMsg('')
  }

  const changeAppName = async () => {
    setAppNameChangeApiStatus(AppNameChangeApiStatus.Loading)

    const result = await changeAppNameFromServer(filters.app.id, appName, router)

    switch (result.status) {
      case AppNameChangeApiStatus.Error:
        setAppNameChangeApiStatus(AppNameChangeApiStatus.Error)
        break
      case AppNameChangeApiStatus.Success:
        setAppNameChangeApiStatus(AppNameChangeApiStatus.Success)
        location.reload()
        break
    }
  }

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display text-4xl max-w-6xl text-center">Apps</p>
      <div className="py-4" />
      <Filters
        teamId={params.teamId}
        filtersApiType={FiltersApiType.All}
        appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
        showCreateApp={false}
        showNoData={false}
        showNotOnboarded={false}
        showAppSelector={true}
        showAppVersions={false}
        showDates={false}
        showSessionType={false}
        showOsVersions={false}
        showCountries={false}
        showNetworkTypes={false}
        showNetworkProviders={false}
        showNetworkGenerations={false}
        showLocales={false}
        showDeviceManufacturers={false}
        showDeviceNames={false}
        showBugReportStatus={false}
        showUdAttrs={false}
        showFreeText={false}
        onFiltersChanged={(updatedFilters) => setFilters(updatedFilters)} />


      {/* Main UI*/}
      {filters.ready &&
        <div>
          {/* Modal for confirming app name change */}
          <DangerConfirmationModal body={<p className="font-body">Are you sure you want to rename app <span className="font-display font-bold">{filters.app.name}</span> to <span className="font-display font-bold">{appName}</span>?</p>} open={appNameConfirmationModalOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setAppNameConfirmationModalOpen(false)
              changeAppName()
            }}
            onCancelAction={() => setAppNameConfirmationModalOpen(false)}
          />

          <div className="font-body">
            <div className="flex flex-col">
              <div className="flex flex-row items-center">
                <p>App name:</p>
                <div className="px-1" />
                <input id="change-app-name-input" type="text" value={appName}
                  onChange={(event) => {
                    event.target.value === filters.app.name ? setSaveAppNameButtonDisabled(true) : setSaveAppNameButtonDisabled(false)
                    setAppName(event.target.value)
                    setAppNameChangeApiStatus(AppNameChangeApiStatus.Init)
                  }}
                  className="w-96 border border-black rounded-md outline-none focus-visible:outline-yellow-300 py-2 px-4 font-body placeholder:text-neutral-400" />
                <button disabled={saveAppNameButtonDisabled || appNameChangeApiStatus === AppNameChangeApiStatus.Loading} className="m-4 outline-none flex justify-center hover:enabled:bg-yellow-200 active:enabled:bg-yellow-300 focus-visible:enabled:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4" onClick={() => setAppNameConfirmationModalOpen(true)}>Save</button>
                {appNameChangeApiStatus === AppNameChangeApiStatus.Loading && <p className="text-sm align-bottom font-display">Changing app name...</p>}
                {appNameChangeApiStatus === AppNameChangeApiStatus.Error && <p className="text-sm align-bottom font-display">Error changing app name, please try again</p>}
              </div>
              <p>Package name: {filters.app.unique_identifier}</p>
              <div className="py-1" />
              <p>Platform: {filters.app.platform}</p>
              <div className="py-1" />
              <p>Created at: {formatDateToHumanReadableDateTime(filters.app.created_at)}</p>
            </div>
            <div className="flex flex-row items-center">
              <p>Data retention period</p>
              <div className="px-2" />
              {fetchAppSettingsApiStatus === FetchAppSettingsApiStatus.Loading && <p>: Loading...</p>}
              {fetchAppSettingsApiStatus === FetchAppSettingsApiStatus.Error && <p>: Unable to fetch retention period. Please refresh page to try again.</p>}
              {fetchAppSettingsApiStatus === FetchAppSettingsApiStatus.Success && <DropdownSelect type={DropdownSelectType.SingleString} title="Data Retention Period" items={Array.from(retentionPeriodToDisplayTextMap.values())} initialSelected={retentionPeriodToDisplayTextMap.get(appSettings.retention_period!)!} onChangeSelected={(item) => handleRetentionPeriodChange(item as string)} />}
              {fetchAppSettingsApiStatus === FetchAppSettingsApiStatus.Success && <button className="m-4 outline-none flex justify-center hover:enabled:bg-yellow-200 active:enabled:bg-yellow-300 focus-visible:enabled:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4" disabled={!currentUserCanChangeAppSettings || updateAppSettingsApiStatus === UpdateAppSettingsApiStatus.Loading || appSettings.retention_period === updatedAppSettings.retention_period} onClick={() => saveAppSettings()}>Save</button>}
              <div className="py-1" />
              {updateAppSettingsApiStatus !== UpdateAppSettingsApiStatus.Init && <p className="text-sm font-body">{updateAppSettingsMsg}</p>}
            </div>
            <div className="flex flex-row items-center">
              <p>Base URL</p>
              <div className="px-2" />
              <input type="text" readOnly={true} value={process.env.NEXT_PUBLIC_API_BASE_URL} className="w-96 border border-black rounded-md outline-none focus-visible:outline-yellow-300 py-2 px-4 font-body placeholder:text-neutral-400" />
              <button className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4" onClick={() => navigator.clipboard.writeText(process.env.NEXT_PUBLIC_API_BASE_URL!)}>Copy</button>
            </div>
            <div className="flex flex-row items-center">
              <p>API key</p>
              <div className="px-3" />
              <input type="text" readOnly={true} value={filters.app.api_key.key} className="w-96 border border-black rounded-md outline-none focus-visible:outline-yellow-300 py-2 px-4 font-body placeholder:text-neutral-400" />
              <button className="mx-4 my-1 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4" onClick={() => navigator.clipboard.writeText(filters.app.api_key.key)}>Copy</button>
            </div>
          </div>
        </div>
      }
      <div className="py-8" />
      <div className="w-full border border-black h-0" />
      <div className="py-4" />
      <CreateApp teamId={params.teamId} />
    </div>
  )
}
