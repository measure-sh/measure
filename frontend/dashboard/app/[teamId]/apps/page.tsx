"use client"

import { AppApiKeyChangeApiStatus, AppNameChangeApiStatus, AuthzAndMembersApiStatus, changeAppApiKeyFromServer, changeAppNameFromServer, emptyAppRetention, FetchAppRetentionApiStatus, fetchAppRetentionFromServer, fetchAuthzAndMembersFromServer, FetchBillingInfoApiStatus, fetchBillingInfoFromServer, fetchSdkConfigFromServer, FilterSource, SdkConfig, SdkConfigApiStatus, UpdateAppRetentionApiStatus, updateAppRetentionFromServer } from "@/app/api/api_calls"
import { measureAuth } from "@/app/auth/measure_auth"
import { Button } from "@/app/components/button"
import CreateApp from "@/app/components/create_app"
import DangerConfirmationDialog from "@/app/components/danger_confirmation_dialog"
import DropdownSelect, { DropdownSelectType } from "@/app/components/dropdown_select"
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from "@/app/components/filters"
import { Input } from "@/app/components/input"
import LoadingSpinner from "@/app/components/loading_spinner"
import SdkConfigurator from "@/app/components/sdk_configurator"
import { isCloud } from "@/app/utils/env_utils"
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

  const [fetchBillingInfoApiStatus, setFetchBillingInfoApiStatus] = useState(FetchBillingInfoApiStatus.Loading)
  const [retentionChangeAllowed, setRetentionChangeAllowed] = useState(false)

  const [updateAppRetentionApiStatus, setUpdateAppRetentionApiStatus] = useState(UpdateAppRetentionApiStatus.Init)
  const [appRetention, setAppRetention] = useState(emptyAppRetention)
  const [updatedAppRetention, setUpdatedAppRetention] = useState(emptyAppRetention)

  const [saveAppNameButtonDisabled, setSaveAppNameButtonDisabled] = useState(true)

  const [appNameConfirmationDialogOpen, setAppNameConfirmationDialogOpen] = useState(false)
  const [appApiKeyConfirmationDialogOpen, setAppApiKeyConfirmationDialogOpen] = useState(false)
  const [appNameChangeApiStatus, setAppNameChangeApiStatus] = useState(AppNameChangeApiStatus.Init)
  const [appApiKeyChangeApiStatus, setAppApiKeyChangeApiStatus] = useState(AppApiKeyChangeApiStatus.Init)
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

        const currentUser = result.data.members.find((member: any) => member.id === session.user.id)
        if (!currentUser) {
          setCurrentUserCanChangeAppSettings(false)
          return
        }

        const currentUserRole = currentUser.role
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
    const [appRetentionResult, sdkConfigResult] = await Promise.all([
      fetchAppRetentionFromServer(filters.app!.id),
      fetchSdkConfigFromServer(filters.app!.id)
    ])

    // Check if both succeeded
    if (
      appRetentionResult.status === FetchAppRetentionApiStatus.Success &&
      sdkConfigResult.status === SdkConfigApiStatus.Success
    ) {
      setPageLoadStatus(PageLoadStatus.Success)

      // Set app settings
      setAppRetention(appRetentionResult.data)
      setUpdatedAppRetention(appRetentionResult.data)

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

  const getRetentionChangeAllowed = async () => {
    if (!isCloud()) {
      // always allow for self-hosted
      setRetentionChangeAllowed(true)
      return
    }

    setFetchBillingInfoApiStatus(FetchBillingInfoApiStatus.Loading)

    const result = await fetchBillingInfoFromServer(params.teamId)

    switch (result.status) {
      case FetchBillingInfoApiStatus.Error:
        setFetchBillingInfoApiStatus(FetchBillingInfoApiStatus.Error)
        break
      case FetchBillingInfoApiStatus.Success:
        setFetchBillingInfoApiStatus(FetchBillingInfoApiStatus.Success)
        if (result.data.plan === 'free') {
          setRetentionChangeAllowed(false)
        } else {
          setRetentionChangeAllowed(true)
        }
        break
    }
  }

  useEffect(() => {
    getRetentionChangeAllowed()
  }, [])

  const saveAppRetention = async () => {
    setUpdateAppRetentionApiStatus(UpdateAppRetentionApiStatus.Loading)

    const result = await updateAppRetentionFromServer(filters.app!.id, updatedAppRetention)

    switch (result.status) {
      case UpdateAppRetentionApiStatus.Error:
        setUpdateAppRetentionApiStatus(UpdateAppRetentionApiStatus.Error)
        toastNegative("Error saving app settings", result.error)
        break
      case UpdateAppRetentionApiStatus.Success:
        setUpdateAppRetentionApiStatus(UpdateAppRetentionApiStatus.Success)
        setAppRetention(updatedAppRetention)
        toastPositive("Your app settings have been saved")
        break
      case UpdateAppRetentionApiStatus.Cancelled:
        setUpdateAppRetentionApiStatus(UpdateAppRetentionApiStatus.Cancelled)
        break
    }
  }

  const retentionPeriodToDisplayTextMap = new Map([
    [30, '1 month'],
    [90, '3 months'],
    [180, '6 months'],
    [365, '1 year']]
  )

  const displayTextToRetentionPeriodMap = new Map([
    ['1 month', 30],
    ['3 months', 90],
    ['6 months', 180],
    ['1 year', 365]]
  )

  const handleRetentionPeriodChange = (newRetentionPeriod: string) => {
    setUpdatedAppRetention({ retention: displayTextToRetentionPeriodMap.get(newRetentionPeriod)! })
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
      case AppNameChangeApiStatus.Cancelled:
        setAppNameChangeApiStatus(AppNameChangeApiStatus.Cancelled)
        break
    }
  }

  const changeAppApiKey = async () => {
    setAppApiKeyChangeApiStatus(AppApiKeyChangeApiStatus.Loading)

    const result = await changeAppApiKeyFromServer(filters.app!.id)

    switch (result.status) {
      case AppApiKeyChangeApiStatus.Error:
        setAppApiKeyChangeApiStatus(AppApiKeyChangeApiStatus.Error)
        toastNegative("Error rotating API key")
        break
      case AppApiKeyChangeApiStatus.Success:
        setAppApiKeyChangeApiStatus(AppApiKeyChangeApiStatus.Success)
        toastPositive("API key rotated")
        if (filtersRef.current?.refresh) {
          filtersRef.current.refresh()
        }
        break
      case AppApiKeyChangeApiStatus.Cancelled:
        setAppApiKeyChangeApiStatus(AppApiKeyChangeApiStatus.Cancelled)
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
        showSessionTypes={false}
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

          <DangerConfirmationDialog body={<p className="font-body">Are you sure you want to rotate the API key for app <span className="font-display font-bold">{filters.app!.name}</span>? <br /> <br /> All apps currently using this key won&apos;t be able to send data anymore until they are updated.</p>} open={appApiKeyConfirmationDialogOpen} affirmativeText="Yes, rotate key" cancelText="Cancel"
            onAffirmativeAction={() => {
              setAppApiKeyConfirmationDialogOpen(false)
              changeAppApiKey()
            }}
            onCancelAction={() => setAppApiKeyConfirmationDialogOpen(false)}
          />

          {/* Dialog for confirming app retention period change */}
          <DangerConfirmationDialog body={<p className="font-body">Are you sure you want to change the retention period for app <span className="font-display font-bold">{filters.app!.name}</span> to <span className="font-display font-bold">{updatedAppRetention.retention} days</span>? <br /> <br /> This change only affects new sessions, current sessions will retain their original retention period.</p>} open={appRetentionPeriodConfirmationDialogOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setAppRetentionPeriodConfirmationDialogOpen(false)
              saveAppRetention()
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
            <p className="font-display text-xl max-w-6xl">Configure Data Retention</p>
            <div className="flex flex-row items-center mt-2">
              <DropdownSelect
                disabled={!retentionChangeAllowed}
                type={DropdownSelectType.SingleString}
                title="Data Retention Period"
                items={Array.from(retentionPeriodToDisplayTextMap.values())}
                initialSelected={retentionPeriodToDisplayTextMap.get(appRetention.retention!)!}
                onChangeSelected={(item) => handleRetentionPeriodChange(item as string)} />
              <Button
                variant="outline"
                className="m-4"
                disabled={!retentionChangeAllowed || !currentUserCanChangeAppSettings || updateAppRetentionApiStatus === UpdateAppRetentionApiStatus.Loading || appRetention.retention === updatedAppRetention.retention}
                loading={updateAppRetentionApiStatus === UpdateAppRetentionApiStatus.Loading}
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
            <div className="py-8" />
            <p className="font-display text-xl max-w-6xl">Rotate API key</p>
            <div className="flex flex-row items-center mt-2">
              <p className="text-sm">API key</p>
              <div className="px-3" />
              <Input type="text" readOnly={true} value={filters.app!.api_key.key} className="w-96" />
              {currentUserCanChangeAppSettings &&
                <Button
                  variant="destructive"
                  disabled={appApiKeyChangeApiStatus === AppApiKeyChangeApiStatus.Loading}
                  className="mx-4 my-3"
                  loading={appApiKeyChangeApiStatus === AppApiKeyChangeApiStatus.Loading}
                  onClick={() => setAppApiKeyConfirmationDialogOpen(true)}>
                  Rotate
                </Button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 
