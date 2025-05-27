"use client"

import { AppNameChangeApiStatus, AuthzAndMembersApiStatus, changeAppNameFromServer, emptyAppSettings, FetchAppSettingsApiStatus, fetchAppSettingsFromServer, fetchAuthzAndMembersFromServer, FilterSource, UpdateAppSettingsApiStatus, updateAppSettingsFromServer } from "@/app/api/api_calls"
import CreateApp from "@/app/components/create_app"
import DangerConfirmationModal from "@/app/components/danger_confirmation_dialog"
import DropdownSelect, { DropdownSelectType } from "@/app/components/dropdown_select"
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from "@/app/components/filters"
import { measureAuth } from "@/app/auth/measure_auth"
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils"
import React, { useState, useEffect } from 'react'
import { Button } from "@/app/components/button"
import { toastNegative, toastPositive } from "@/app/utils/use_toast"
import LoadingSpinner from "@/app/components/loading_spinner"

export default function Apps({ params }: { params: { teamId: string } }) {
  const [filters, setFilters] = useState(defaultFilters)

  const [currentUserCanChangeAppSettings, setCurrentUserCanChangeAppSettings] = useState(false)

  const [fetchAppSettingsApiStatus, setFetchAppSettingsApiStatus] = useState(FetchAppSettingsApiStatus.Loading)
  const [updateAppSettingsApiStatus, setUpdateAppSettingsApiStatus] = useState(UpdateAppSettingsApiStatus.Init)
  const [appSettings, setAppSettings] = useState(emptyAppSettings)
  const [updatedAppSettings, setUpdatedAppSettings] = useState(emptyAppSettings)

  const [saveAppNameButtonDisabled, setSaveAppNameButtonDisabled] = useState(true)

  const [appNameConfirmationModalOpen, setAppNameConfirmationModalOpen] = useState(false)
  const [appNameChangeApiStatus, setAppNameChangeApiStatus] = useState(AppNameChangeApiStatus.Init)
  const [appName, setAppName] = useState('')

  const getCurrentUserCanChangeAppSettings = async () => {
    const result = await fetchAuthzAndMembersFromServer(params.teamId)

    switch (result.status) {
      case AuthzAndMembersApiStatus.Error:
        break
      case AuthzAndMembersApiStatus.Success:
        const { session, error } = await measureAuth.getSession()
        if (error) {
          console.error("Error getting session: ", error)
          return
        }

        const currentUserRole = result.data.members.find((member: any) => member.id === session.user.id)!.role
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
  }, [params.teamId])

  const getAppSettings = async () => {
    setFetchAppSettingsApiStatus(FetchAppSettingsApiStatus.Loading)

    const result = await fetchAppSettingsFromServer(filters.app!.id)

    switch (result.status) {
      case FetchAppSettingsApiStatus.Error:
        setFetchAppSettingsApiStatus(FetchAppSettingsApiStatus.Error)
        break
      case FetchAppSettingsApiStatus.Success:
        setFetchAppSettingsApiStatus(FetchAppSettingsApiStatus.Success)
        setAppSettings(result.data)
        setUpdatedAppSettings(result.data)
        break
    }
  }

  useEffect(() => {
    // Don't try to fetch settings if selected app is not yet set
    if (!filters.ready) {
      return
    }

    setAppName(filters.app!.name)
    getAppSettings()
  }, [filters])

  const saveAppSettings = async () => {
    setUpdateAppSettingsApiStatus(UpdateAppSettingsApiStatus.Loading)

    const result = await updateAppSettingsFromServer(filters.app!.id, updatedAppSettings)

    switch (result.status) {

      case UpdateAppSettingsApiStatus.Error:
        setUpdateAppSettingsApiStatus(UpdateAppSettingsApiStatus.Error)
        toastNegative("Error saving app settings", result.error)
        break
      case UpdateAppSettingsApiStatus.Success:
        setUpdateAppSettingsApiStatus(UpdateAppSettingsApiStatus.Error)
        setAppSettings(updatedAppSettings)
        toastPositive("Your app settings have been saved successfully!")
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
  }

  const changeAppName = async () => {
    setAppNameChangeApiStatus(AppNameChangeApiStatus.Loading)

    const result = await changeAppNameFromServer(filters.app!.id, appName)

    switch (result.status) {
      case AppNameChangeApiStatus.Error:
        setAppNameChangeApiStatus(AppNameChangeApiStatus.Error)
        toastNegative("Error changing app name")
        break
      case AppNameChangeApiStatus.Success:
        setAppNameChangeApiStatus(AppNameChangeApiStatus.Success)
        location.reload()
        break
    }
  }

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <p className="font-display text-4xl max-w-6xl text-center">Apps</p>
      <div className="py-4" />
      <Filters
        teamId={params.teamId}
        filterSource={FilterSource.Events}
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
          <DangerConfirmationModal body={<p className="font-body">Are you sure you want to rename app <span className="font-display font-bold">{filters.app!.name}</span> to <span className="font-display font-bold">{appName}</span>?</p>} open={appNameConfirmationModalOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
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
                    event.target.value === filters.app!.name ? setSaveAppNameButtonDisabled(true) : setSaveAppNameButtonDisabled(false)
                    setAppName(event.target.value)
                    setAppNameChangeApiStatus(AppNameChangeApiStatus.Init)
                  }}
                  className="w-96 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400" />
                <Button
                  variant="outline"
                  disabled={saveAppNameButtonDisabled || appNameChangeApiStatus === AppNameChangeApiStatus.Loading}
                  className="m-4 font-display border border-black rounded-md select-none"
                  onClick={() => setAppNameConfirmationModalOpen(true)}>
                  {appNameChangeApiStatus === AppNameChangeApiStatus.Loading ? (
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <LoadingSpinner />
                      </span>
                      <span style={{ visibility: "hidden" }}>Save</span>
                    </span>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
              <p>Package name: {filters.app!.unique_identifier}</p>
              <div className="py-1" />
              <p>Platform: {filters.app!.os_name}</p>
              <div className="py-1" />
              <p>Created at: {formatDateToHumanReadableDateTime(filters.app!.created_at)}</p>
            </div>
            <div className="flex flex-row items-center">
              <p>Data retention period</p>
              <div className="px-2" />
              {fetchAppSettingsApiStatus === FetchAppSettingsApiStatus.Loading && <LoadingSpinner />}
              {fetchAppSettingsApiStatus === FetchAppSettingsApiStatus.Error && <p>: Unable to fetch retention period. Please refresh page to try again.</p>}
              {fetchAppSettingsApiStatus === FetchAppSettingsApiStatus.Success && <DropdownSelect type={DropdownSelectType.SingleString} title="Data Retention Period" items={Array.from(retentionPeriodToDisplayTextMap.values())} initialSelected={retentionPeriodToDisplayTextMap.get(appSettings.retention_period!)!} onChangeSelected={(item) => handleRetentionPeriodChange(item as string)} />}
              {fetchAppSettingsApiStatus === FetchAppSettingsApiStatus.Success &&
                <Button
                  variant="outline"
                  className="m-4 font-display border border-black rounded-md select-none"
                  disabled={!currentUserCanChangeAppSettings || updateAppSettingsApiStatus === UpdateAppSettingsApiStatus.Loading || appSettings.retention_period === updatedAppSettings.retention_period}
                  loading={updateAppSettingsApiStatus === UpdateAppSettingsApiStatus.Loading}
                  onClick={() => saveAppSettings()}>
                  Save
                </Button>
              }
            </div>
            <div className="flex flex-row items-center">
              <p>Base URL</p>
              <div className="px-2" />
              <input type="text" readOnly={true} value={process.env.NEXT_PUBLIC_API_BASE_URL} className="w-96 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400" />
              <Button
                variant="outline"
                className="m-4 font-display border border-black rounded-md select-none"
                onClick={() => {
                  navigator.clipboard.writeText(process.env.NEXT_PUBLIC_API_BASE_URL!)
                  toastPositive("Base URL copied to clipboard")
                }}>
                Copy
              </Button>
            </div>
            <div className="flex flex-row items-center">
              <p>API key</p>
              <div className="px-3" />
              <input type="text" readOnly={true} value={filters.app!.api_key.key} className="w-96 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400" />
              <Button
                variant="outline"
                className="m-4 font-display border border-black rounded-md select-none"
                onClick={() => {
                  navigator.clipboard.writeText(filters.app!.api_key.key)
                  toastPositive("API key copied to clipboard")
                }}>
                Copy
              </Button>
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
