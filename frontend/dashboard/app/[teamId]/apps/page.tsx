"use client"

import { AppNameChangeApiStatus, AuthzAndMembersApiStatus, changeAppNameFromServer, emptyAppSettings, FetchAppSettingsApiStatus, fetchAppSettingsFromServer, fetchAuthzAndMembersFromServer, fetchSdkConfigFromServer, FilterSource, SdkConfig, SdkConfigApiStatus, UpdateAppSettingsApiStatus, updateAppSettingsFromServer } from "@/app/api/api_calls"
import { measureAuth } from "@/app/auth/measure_auth"
import { Button } from "@/app/components/button"
import CreateApp from "@/app/components/create_app"
import DangerConfirmationDialog from "@/app/components/danger_confirmation_dialog"
import DropdownSelect, { DropdownSelectType } from "@/app/components/dropdown_select"
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from "@/app/components/filters"
import { Input } from "@/app/components/input"
import LoadingSpinner from "@/app/components/loading_spinner"
import SdkConfigurator from "@/app/components/sdk_configurator"
import { underlineLinkStyle } from "@/app/utils/shared_styles"
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils"
import { toastNegative, toastPositive } from "@/app/utils/use_toast"
import Link from "next/link"
import { useEffect, useRef, useState } from 'react'

// Combined loading state for both APIs
enum PageLoadStatus {
  Init = "Init",
  Loading = "Loading",
  Success = "Success",
  Error = "Error"
}

export default function Apps({ params }: { params: { teamId: string } }) {
  const [filters, setFilters] = useState(defaultFilters)

  const [currentUserCanChangeAppSettings, setCurrentUserCanChangeAppSettings] = useState(false)

  const [appRetentionPeriodConfirmationDialogOpen, setAppRetentionPeriodConfirmationDialogOpen] = useState(false)
  const [pageLoadStatus, setPageLoadStatus] = useState(PageLoadStatus.Init)
  const [updateAppSettingsApiStatus, setUpdateAppSettingsApiStatus] = useState(UpdateAppSettingsApiStatus.Init)
  const [appSettings, setAppSettings] = useState(emptyAppSettings)
  const [updatedAppSettings, setUpdatedAppSettings] = useState(emptyAppSettings)

  const [saveAppNameButtonDisabled, setSaveAppNameButtonDisabled] = useState(true)

  const [appNameConfirmationDialogOpen, setAppNameConfirmationDialogOpen] = useState(false)
  const [appNameChangeApiStatus, setAppNameChangeApiStatus] = useState(AppNameChangeApiStatus.Init)
  const [appName, setAppName] = useState('')

  // SDK configuration state - null until loaded from server
  const [sdkConfig, setSdkConfig] = useState<SdkConfig | null>(null)

  const filtersRef = useRef<any>(null)

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

  const loadPageData = async () => {
    setPageLoadStatus(PageLoadStatus.Loading)

    // Fetch both APIs in parallel
    const [appSettingsResult, sdkConfigResult] = await Promise.all([
      fetchAppSettingsFromServer(filters.app!.id),
      fetchSdkConfigFromServer(filters.app!.id)
    ])

    // Check if both succeeded
    if (
      appSettingsResult.status === FetchAppSettingsApiStatus.Success &&
      sdkConfigResult.status === SdkConfigApiStatus.Success
    ) {
      setPageLoadStatus(PageLoadStatus.Success)

      // Set app settings
      setAppSettings(appSettingsResult.data)
      setUpdatedAppSettings(appSettingsResult.data)

      // Set SDK config directly from API response - no manual mapping needed
      setSdkConfig(sdkConfigResult.data)
    } else {
      setPageLoadStatus(PageLoadStatus.Error)
    }
  }

  useEffect(() => {
    // Don't try to fetch settings if selected app is not yet set
    if (!filters.ready) {
      return
    }

    setAppName(filters.app!.name)
    loadPageData()
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
        setUpdateAppSettingsApiStatus(UpdateAppSettingsApiStatus.Success)
        setAppSettings(updatedAppSettings)
        toastPositive("Your app settings have been saved")
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
        setSaveAppNameButtonDisabled(true)
        setAppNameChangeApiStatus(AppNameChangeApiStatus.Success)
        toastPositive("App name changed")
        if (filtersRef.current?.refresh) {
          filtersRef.current.refresh()
        }
        break
    }
  }

  return (
    <div className="flex flex-col items-start">
      <div className="flex flex-row items-center gap-2 justify-between w-full">
        <p className="font-display text-4xl max-w-6xl text-center">Apps</p>
        <CreateApp
          teamId={params.teamId}
          disabled={!currentUserCanChangeAppSettings}
          onSuccess={(app) => {
            filtersRef.current?.refresh(app.id)
          }} />
      </div>
      <div className="py-4" />
      <Filters
        ref={filtersRef}
        teamId={params.teamId}
        filterSource={FilterSource.Events}
        appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
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

      {/* Loading State */}
      {pageLoadStatus === PageLoadStatus.Loading && filters.ready && (
        <div className="flex items-center justify-center w-full py-20">
          <LoadingSpinner />
        </div>
      )}

      {/* Error State */}
      {pageLoadStatus === PageLoadStatus.Error && filters.ready && (
        <span className="text-xs font-body">
          Error fetching app settings. Please refresh page to try again.
        </span>
      )}

      {/* Main UI - Only show when both APIs succeed and SDK config is loaded */}
      {filters.ready && pageLoadStatus === PageLoadStatus.Success && sdkConfig && (
        <div className="w-full max-w-6xl">
          {/* Dialog for confirming app name change */}
          <DangerConfirmationDialog body={<p className="font-body">Are you sure you want to rename app <span className="font-display font-bold">{filters.app!.name}</span> to <span className="font-display font-bold">{appName}</span>?</p>} open={appNameConfirmationDialogOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setAppNameConfirmationDialogOpen(false)
              changeAppName()
            }}
            onCancelAction={() => setAppNameConfirmationDialogOpen(false)}
          />

          {/* Dialog for confirming app retention period change */}
          <DangerConfirmationDialog body={<p className="font-body">Are you sure you want to change the retention period for app <span className="font-display font-bold">{filters.app!.name}</span> to <span className="font-display font-bold">{updatedAppSettings.retention_period} days</span>? <br /> <br /> This change only affects new sessions, current sessions will retain their original retention period.</p>} open={appRetentionPeriodConfirmationDialogOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setAppRetentionPeriodConfirmationDialogOpen(false)
              saveAppSettings()
            }}
            onCancelAction={() => setAppRetentionPeriodConfirmationDialogOpen(false)}
          />

          <div className="font-body">
            <div className="flex flex-col">
              {filters.app!.unique_identifier && filters.app!.os_name && <p className="font-display text-muted-foreground">Unique Identifier</p>}
              {filters.app!.unique_identifier && filters.app!.os_name && <p className="text-sm mt-0.5">{filters.app!.unique_identifier}</p>}
              {filters.app!.unique_identifier && filters.app!.os_name && <p className="font-display text-muted-foreground mt-6">Operating System</p>}
              {filters.app!.unique_identifier && filters.app!.os_name && <p className="text-sm mt-0.5">{filters.app!.os_name}</p>}
              {filters.app!.unique_identifier && filters.app!.os_name && <p className="font-display text-muted-foreground mt-6">Created at</p>}
              {filters.app!.unique_identifier && filters.app!.os_name && <p className="text-sm mt-0.5">{formatDateToHumanReadableDateTime(filters.app!.created_at)}</p>}
              {(!filters.app!.unique_identifier || !filters.app!.os_name) &&
                <p className="font-body text-sm">Follow our <Link target='_blank' className={underlineLinkStyle} href='https://github.com/measure-sh/measure?tab=readme-ov-file#docs'>docs</Link> to finish setting up your app.</p>}
            </div>
            <div className="py-10" />
            <p className="font-display text-xl max-w-6xl">Copy SDK Variables</p>
            <div className="flex flex-row items-center mt-2">
              <p className="text-sm">API URL</p>
              <div className="px-3" />
              <Input type="text" readOnly={true} value={process.env.NEXT_PUBLIC_API_BASE_URL} className="w-96" />
              <Button
                variant="outline"
                className="mx-4 my-3"
                onClick={() => {
                  navigator.clipboard.writeText(process.env.NEXT_PUBLIC_API_BASE_URL!)
                  toastPositive("Base URL copied to clipboard")
                }}>
                Copy
              </Button>
            </div>
            <div className="flex flex-row items-center">
              <p className="text-sm">API key</p>
              <div className="px-3" />
              <Input type="text" readOnly={true} value={filters.app!.api_key.key} className="w-96" />
              <Button
                variant="outline"
                className="mx-4 my-3"
                onClick={() => {
                  navigator.clipboard.writeText(filters.app!.api_key.key)
                  toastPositive("API key copied to clipboard")
                }}>
                Copy
              </Button>
            </div>
            <div className="py-8" />

            <SdkConfigurator
              appId={filters.app!.id}
              appName={filters.app!.name}
              osName={filters.app!.os_name}
              initialConfig={sdkConfig}
              currentUserCanChangeAppSettings={currentUserCanChangeAppSettings}

            />

            <div className="py-8" />
            <p className="font-display text-xl max-w-6xl">Configure Data Rentention</p>
            <div className="flex flex-row items-center mt-2">
              <DropdownSelect type={DropdownSelectType.SingleString} title="Data Retention Period" items={Array.from(retentionPeriodToDisplayTextMap.values())} initialSelected={retentionPeriodToDisplayTextMap.get(appSettings.retention_period!)!} onChangeSelected={(item) => handleRetentionPeriodChange(item as string)} />
              <Button
                variant="outline"
                className="m-4"
                disabled={!currentUserCanChangeAppSettings || updateAppSettingsApiStatus === UpdateAppSettingsApiStatus.Loading || appSettings.retention_period === updatedAppSettings.retention_period}
                loading={updateAppSettingsApiStatus === UpdateAppSettingsApiStatus.Loading}
                onClick={() => setAppRetentionPeriodConfirmationDialogOpen(true)}>
                Save
              </Button>
            </div>
            <div className="py-8" />
            <p className="font-display text-xl max-w-6xl">Change App Name</p>
            <div className="flex flex-row items-center mt-2">
              <Input id="change-app-name-input" type="text"
                value={appName}
                onChange={(event) => {
                  event.target.value === filters.app!.name ? setSaveAppNameButtonDisabled(true) : setSaveAppNameButtonDisabled(false)
                  setAppName(event.target.value)
                  setAppNameChangeApiStatus(AppNameChangeApiStatus.Init)
                }}
                className="w-96" />
              <Button
                variant="outline"
                disabled={!currentUserCanChangeAppSettings || saveAppNameButtonDisabled || appNameChangeApiStatus === AppNameChangeApiStatus.Loading}
                className="m-4"
                loading={appNameChangeApiStatus === AppNameChangeApiStatus.Loading}
                onClick={() => setAppNameConfirmationDialogOpen(true)}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 