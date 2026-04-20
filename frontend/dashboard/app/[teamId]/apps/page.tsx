"use client"
import {
  useAppRetentionQuery,
  useAppThresholdPrefsQuery,
  useAuthzAndMembersQuery,
  useBillingInfoQuery,
  useChangeAppApiKeyMutation,
  useChangeAppNameMutation,
  useSdkConfigQuery,
  useUpdateAppRetentionMutation,
  useUpdateAppThresholdPrefsMutation,
} from '@/app/query/hooks'
import { useFiltersStore } from '@/app/stores/provider'

import { FilterSource, defaultAppThresholdPrefs, emptyAppRetention } from "@/app/api/api_calls"
import { Button } from "@/app/components/button"
import CreateApp from "@/app/components/create_app"
import DangerConfirmationDialog from "@/app/components/danger_confirmation_dialog"
import DropdownSelect, { DropdownSelectType } from "@/app/components/dropdown_select"
import Filters, { AppVersionsInitialSelectionType } from "@/app/components/filters"
import { Input } from "@/app/components/input"
import SdkConfigNumericInput from "@/app/components/sdk_config_numeric_input"
import SdkConfigurator from "@/app/components/sdk_configurator"
import { Skeleton } from "@/app/components/skeleton"
import { isCloud } from "@/app/utils/env_utils"
import { underlineLinkStyle } from "@/app/utils/shared_styles"
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils"
import { toastNegative, toastPositive } from "@/app/utils/use_toast"
import Link from "next/link"
import { useRef, useState } from 'react'

export default function Apps({ params }: { params: { teamId: string } }) {
  const filters = useFiltersStore(state => state.filters)

  // TanStack Query: reads
  const appId = filters.ready ? filters.app?.id : undefined
  const { data: authzAndMembers } = useAuthzAndMembersQuery(params.teamId)
  const { data: appRetention, status: appRetentionStatus } = useAppRetentionQuery(appId)
  const { data: sdkConfig, status: sdkConfigStatus } = useSdkConfigQuery(appId)
  const { data: thresholdPrefs, status: thresholdPrefsStatus } = useAppThresholdPrefsQuery(appId)
  const { data: billingInfo } = useBillingInfoQuery(params.teamId)

  // TanStack Query: mutations
  const updateRetentionMutation = useUpdateAppRetentionMutation()
  const changeAppNameMutation = useChangeAppNameMutation()
  const changeAppApiKeyMutation = useChangeAppApiKeyMutation()
  const updateThresholdPrefsMutation = useUpdateAppThresholdPrefsMutation()

  // Derive permissions from authz query data
  const canCreateApp = authzAndMembers?.can_create_app === true
  const canRenameApp = authzAndMembers?.can_rename_app === true
  const canChangeRetention = authzAndMembers?.can_change_retention === true
  const canRotateApiKey = authzAndMembers?.can_rotate_api_key === true
  const canWriteSdkConfig = authzAndMembers?.can_write_sdk_config === true
  const canChangeAppThresholdPrefs = authzAndMembers?.can_change_app_threshold_prefs === true

  // Derive retention change allowed from billing info
  const retentionChangeAllowed = !isCloud() || (billingInfo?.plan !== undefined && billingInfo.plan !== 'free')

  // Derive page load status from query statuses
  const pageDataLoading = filters.loading || (filters.ready && (appRetentionStatus === 'pending' || sdkConfigStatus === 'pending'))
  const pageDataError = filters.ready && (appRetentionStatus === 'error' || sdkConfigStatus === 'error')
  const pageDataSuccess = filters.ready && appRetentionStatus === 'success' && sdkConfigStatus === 'success' && sdkConfig

  // UI-only local state
  const [appRetentionPeriodConfirmationDialogOpen, setAppRetentionPeriodConfirmationDialogOpen] = useState(false)
  const [appNameConfirmationDialogOpen, setAppNameConfirmationDialogOpen] = useState(false)
  const [appApiKeyConfirmationDialogOpen, setAppApiKeyConfirmationDialogOpen] = useState(false)
  const [saveAppNameButtonDisabled, setSaveAppNameButtonDisabled] = useState(true)
  const [appName, setAppName] = useState('')

  // Editable form values
  const [updatedRetention, setUpdatedRetention] = useState<typeof emptyAppRetention | null>(null)
  const [editableThresholdPrefs, setEditableThresholdPrefs] = useState<typeof defaultAppThresholdPrefs | null>(null)

  // Use editable values, falling back to server data
  const currentRetention = updatedRetention ?? appRetention ?? emptyAppRetention
  const currentThresholdPrefs = editableThresholdPrefs ?? thresholdPrefs ?? defaultAppThresholdPrefs
  const savedThresholdPrefs = thresholdPrefs ?? defaultAppThresholdPrefs

  const filtersRef = useRef<any>(null)

  // Sync app name when filters become ready or change
  const prevAppNameRef = useRef<string>('')
  if (filters.ready && filters.app && filters.app.name !== prevAppNameRef.current) {
    prevAppNameRef.current = filters.app.name
    setAppName(filters.app.name)
    setSaveAppNameButtonDisabled(true)
    // Reset editable state when app changes
    setUpdatedRetention(null)
    setEditableThresholdPrefs(null)
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
    setUpdatedRetention({ retention: displayTextToRetentionPeriodMap.get(newRetentionPeriod)! })
  }

  const handleUpdateAppThresholdPrefs = async () => {
    if (currentThresholdPrefs.error_good_threshold <= currentThresholdPrefs.error_caution_threshold) {
      toastNegative("Error updating thresholds", "Good threshold must be greater than caution threshold")
      return
    }
    if (currentThresholdPrefs.error_good_threshold <= 0 || currentThresholdPrefs.error_good_threshold > 100) {
      toastNegative("Error updating thresholds", "Good threshold must be between 0 and 100")
      return
    }
    if (currentThresholdPrefs.error_caution_threshold < 0 || currentThresholdPrefs.error_caution_threshold >= 100) {
      toastNegative("Error updating thresholds", "Caution threshold must be between 0 and 100")
      return
    }
    if (currentThresholdPrefs.error_spike_min_count_threshold < 1) {
      toastNegative("Error updating thresholds", "Minimum count must be at least 1")
      return
    }
    if (currentThresholdPrefs.error_spike_min_rate_threshold <= 0 || currentThresholdPrefs.error_spike_min_rate_threshold > 100) {
      toastNegative("Error updating thresholds", "Spike threshold must be between 0 (exclusive) and 100")
      return
    }

    updateThresholdPrefsMutation.mutate(
      { appId: filters.app!.id, prefs: currentThresholdPrefs },
      {
        onSuccess: () => {
          setEditableThresholdPrefs(null)
          toastPositive("Thresholds updated successfully")
        },
        onError: () => {
          toastNegative("Error updating thresholds")
        },
      }
    )
  }

  const handleSaveAppRetention = async () => {
    updateRetentionMutation.mutate(
      { appId: filters.app!.id, retention: currentRetention },
      {
        onSuccess: () => {
          toastPositive("Your app settings have been saved")
        },
        onError: () => {
          toastNegative("Error saving app settings")
        },
      }
    )
  }

  const handleChangeAppName = async () => {
    changeAppNameMutation.mutate(
      { appId: filters.app!.id, appName },
      {
        onSuccess: () => {
          setSaveAppNameButtonDisabled(true)
          toastPositive("App name changed")
          if (filtersRef.current?.refresh) {
            filtersRef.current.refresh()
          }
        },
        onError: () => {
          toastNegative("Error changing app name")
        },
      }
    )
  }

  const handleChangeAppApiKey = async () => {
    changeAppApiKeyMutation.mutate(
      { appId: filters.app!.id },
      {
        onSuccess: () => {
          toastPositive("API key rotated")
          if (filtersRef.current?.refresh) {
            filtersRef.current.refresh()
          }
        },
        onError: () => {
          toastNegative("Error rotating API key")
        },
      }
    )
  }

  const appThresholdValuesChanged =
    currentThresholdPrefs.error_good_threshold !== savedThresholdPrefs.error_good_threshold ||
    currentThresholdPrefs.error_caution_threshold !== savedThresholdPrefs.error_caution_threshold ||
    currentThresholdPrefs.error_spike_min_count_threshold !== savedThresholdPrefs.error_spike_min_count_threshold ||
    currentThresholdPrefs.error_spike_min_rate_threshold !== savedThresholdPrefs.error_spike_min_rate_threshold

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />
      <div className="flex flex-row items-start gap-2 justify-between w-full">
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
          showHttpMethods={false}
          showUdAttrs={false}
          showFreeText={false} />

        <CreateApp
          teamId={params.teamId}
          disabled={!canCreateApp}
          onSuccess={(app) => {
            filtersRef.current?.refresh(app.id)
          }} />
      </div>


      {/* Loading State */}
      {pageDataLoading && (
        <div className="w-full max-w-6xl font-body mt-8">
          {/* App Info */}
          <div className="flex flex-col">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48 mt-1" />
            <Skeleton className="h-4 w-36 mt-6" />
            <Skeleton className="h-4 w-24 mt-1" />
            <Skeleton className="h-4 w-28 mt-6" />
            <Skeleton className="h-4 w-44 mt-1" />
          </div>

          {/* Copy SDK Variables */}
          <div className="py-10" />
          <Skeleton className="h-6 w-48" />
          <div className="flex flex-row items-center mt-2 gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-96" />
            <Skeleton className="h-9 w-16" />
          </div>
          <div className="flex flex-row items-center mt-2 gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-96" />
            <Skeleton className="h-9 w-16" />
          </div>

          {/* SDK Configurator */}
          <div className="py-8" />
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3 w-96 mt-2" />
          <div className="flex flex-col gap-3 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-row items-center gap-2">
                <Skeleton className="h-4 w-80" />
                <Skeleton className="h-9 w-14" />
              </div>
            ))}
          </div>

          {/* Change Error Thresholds */}
          <div className="py-8" />
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-3 w-full max-w-xl mt-2" />
          <div className="flex flex-col gap-3 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-row items-center gap-2">
                <Skeleton className="h-4 w-80" />
                <Skeleton className="h-9 w-14" />
              </div>
            ))}
            <Skeleton className="h-9 w-16 mt-4" />
          </div>

          {/* Configure Data Retention */}
          <div className="py-8" />
          <Skeleton className="h-6 w-52" />
          <div className="flex flex-row items-center mt-2 gap-4">
            <Skeleton className="h-9 w-[150px]" />
            <Skeleton className="h-9 w-16" />
          </div>

          {/* Change App Name */}
          <div className="py-8" />
          <Skeleton className="h-6 w-44" />
          <div className="flex flex-row items-center mt-2 gap-4">
            <Skeleton className="h-9 w-96" />
            <Skeleton className="h-9 w-16" />
          </div>

          {/* Rotate API Key */}
          <div className="py-8" />
          <Skeleton className="h-6 w-36" />
          <div className="flex flex-row items-center mt-2 gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-96" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      )}

      {/* Error State */}
      {pageDataError && (
        <span className="text-xs font-body">
          Error fetching app settings. Please refresh page to try again.
        </span>
      )}

      {/* Main UI - Only show when both APIs succeed and SDK config is loaded */}
      {pageDataSuccess && (
        <div className="w-full max-w-6xl">
          {/* Dialog for confirming app name change */}
          <DangerConfirmationDialog body={<p className="font-body">Are you sure you want to rename app <span className="font-display font-bold">{filters.app!.name}</span> to <span className="font-display font-bold">{appName}</span>?</p>} open={appNameConfirmationDialogOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setAppNameConfirmationDialogOpen(false)
              handleChangeAppName()
            }}
            onCancelAction={() => setAppNameConfirmationDialogOpen(false)}
          />

          <DangerConfirmationDialog body={<p className="font-body">Are you sure you want to rotate the API key for app <span className="font-display font-bold">{filters.app!.name}</span>? <br /> <br /> All apps currently using this key won&apos;t be able to send data anymore until they are updated.</p>} open={appApiKeyConfirmationDialogOpen} affirmativeText="Yes, rotate key" cancelText="Cancel"
            onAffirmativeAction={() => {
              setAppApiKeyConfirmationDialogOpen(false)
              handleChangeAppApiKey()
            }}
            onCancelAction={() => setAppApiKeyConfirmationDialogOpen(false)}
          />

          {/* Dialog for confirming app retention period change */}
          <DangerConfirmationDialog body={<p className="font-body">Are you sure you want to change the retention period for app <span className="font-display font-bold">{filters.app!.name}</span> to <span className="font-display font-bold">{currentRetention.retention} days</span>? <br /> <br /> This change only affects new sessions, current sessions will retain their original retention period.</p>} open={appRetentionPeriodConfirmationDialogOpen} affirmativeText="Yes, I'm sure" cancelText="Cancel"
            onAffirmativeAction={() => {
              setAppRetentionPeriodConfirmationDialogOpen(false)
              handleSaveAppRetention()
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
                <p className="font-body text-sm">Follow our <Link className={underlineLinkStyle} href='/docs'>docs</Link> to finish setting up your app.</p>}
            </div>
            <div className="py-10" />
            <p className="font-display text-xl max-w-6xl">Copy SDK Variables</p>
            <div className="flex flex-row items-center mt-2">
              <p className="text-sm">API URL</p>
              <div className="px-3" />
              <Input type="text" readOnly={true} value={process.env.NEXT_PUBLIC_INGEST_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL} className="w-96" />
              <Button
                variant="outline"
                className="mx-4 my-3"
                onClick={() => {
                  navigator.clipboard.writeText(process.env.NEXT_PUBLIC_INGEST_BASE_URL ? process.env.NEXT_PUBLIC_INGEST_BASE_URL : process.env.NEXT_PUBLIC_API_BASE_URL!)
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
              initialConfig={sdkConfig!}
              currentUserCanChangeAppSettings={canWriteSdkConfig}
            />

            <div className="py-8" />
            <p className="font-display text-xl max-w-6xl">Change Error Thresholds</p>
            <p className="mt-2 font-body text-xs text-muted-foreground">Error rate thresholds affect dashboard overview error-rate status and daily summary email/Slack status icons. Anything below <span className="text-yellow-600 dark:text-yellow-500 font-bold">Caution</span> level is considered <span className="text-red-600 dark:text-red-500 font-bold">Poor</span>.</p>
            {thresholdPrefsStatus === 'pending' &&
              <div className="flex flex-col gap-3 w-full mt-6">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-48" />
              </div>
            }
            {thresholdPrefsStatus === 'error' && <p className="font-body text-sm">Error fetching app threshold preferences, please refresh page to try again</p>}
            {thresholdPrefsStatus === 'success' &&
              <div className="flex flex-col items-start mt-6 gap-3 w-full">
                <div className="flex flex-row items-center gap-2">
                  <p className="font-body text-sm w-80">Error rates <span className="text-green-600 dark:text-green-500 font-bold">Good</span> threshold (%)</p>
                  <SdkConfigNumericInput
                    value={currentThresholdPrefs.error_good_threshold}
                    minValue={0}
                    maxValue={100}
                    step={0.1}
                    type="float"
                    precision={1}
                    fixedWidth={14}
                    disabled={!canChangeAppThresholdPrefs || updateThresholdPrefsMutation.isPending}
                    onChange={(value) => {
                      setEditableThresholdPrefs({
                        ...currentThresholdPrefs,
                        error_good_threshold: value,
                      })
                    }}
                    testId="error-good-threshold-input"
                  />
                </div>
                <div className="flex flex-row items-center gap-2">
                  <p className="font-body text-sm w-80">Error rates <span className="text-yellow-600 dark:text-yellow-500 font-bold">Caution</span> threshold (%)</p>
                  <SdkConfigNumericInput
                    value={currentThresholdPrefs.error_caution_threshold}
                    minValue={0}
                    maxValue={100}
                    step={0.1}
                    type="float"
                    precision={1}
                    fixedWidth={14}
                    disabled={!canChangeAppThresholdPrefs || updateThresholdPrefsMutation.isPending}
                    onChange={(value) => {
                      setEditableThresholdPrefs({
                        ...currentThresholdPrefs,
                        error_caution_threshold: value,
                      })
                    }}
                    testId="error-caution-threshold-input"
                  />
                </div>
                <p className="mt-6 font-body text-xs text-muted-foreground">An error alert is triggered when an error group reaches the configured minimum error count and the percentage of sessions it impacts meets or exceeds the spike threshold within an hour.</p>
                <div className="flex flex-row items-center gap-2 mt-2">
                  <p className="font-body text-sm w-80">Minimum error count to trigger a spike alert</p>
                  <SdkConfigNumericInput
                    value={currentThresholdPrefs.error_spike_min_count_threshold}
                    minValue={1}
                    maxValue={1000000}
                    step={1}
                    type="integer"
                    fixedWidth={14}
                    disabled={!canChangeAppThresholdPrefs || updateThresholdPrefsMutation.isPending}
                    onChange={(value) => {
                      setEditableThresholdPrefs({
                        ...currentThresholdPrefs,
                        error_spike_min_count_threshold: value,
                      })
                    }}
                    testId="error-spike-min-count-threshold-input"
                  />
                </div>
                <div className="flex flex-row items-center gap-2">
                  <p className="font-body text-sm w-80">Spike alert threshold (%)</p>
                  <SdkConfigNumericInput
                    value={currentThresholdPrefs.error_spike_min_rate_threshold}
                    minValue={0}
                    maxValue={100}
                    step={0.1}
                    type="float"
                    precision={1}
                    fixedWidth={14}
                    disabled={!canChangeAppThresholdPrefs || updateThresholdPrefsMutation.isPending}
                    onChange={(value) => {
                      setEditableThresholdPrefs({
                        ...currentThresholdPrefs,
                        error_spike_min_rate_threshold: value,
                      })
                    }}
                    testId="error-spike-min-rate-threshold-input"
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-fit py-2 mt-4"
                  disabled={!canChangeAppThresholdPrefs || updateThresholdPrefsMutation.isPending || !appThresholdValuesChanged}
                  loading={updateThresholdPrefsMutation.isPending}
                  aria-label="Save thresholds"
                  onClick={handleUpdateAppThresholdPrefs}
                >
                  Save
                </Button>
              </div>
            }
            <div className="py-8" />
            <p className="font-display text-xl max-w-6xl">Configure Data Retention</p>
            <div className="flex flex-row items-center mt-2">
              <DropdownSelect
                disabled={!retentionChangeAllowed || !canChangeRetention}
                type={DropdownSelectType.SingleString}
                title="Data Retention Period"
                items={Array.from(retentionPeriodToDisplayTextMap.values())}
                initialSelected={retentionPeriodToDisplayTextMap.get((appRetention ?? emptyAppRetention).retention!)!}
                onChangeSelected={(item) => handleRetentionPeriodChange(item as string)} />
              <Button
                variant="outline"
                className="m-4"
                disabled={!retentionChangeAllowed || !canChangeRetention || updateRetentionMutation.isPending || (appRetention ?? emptyAppRetention).retention === currentRetention.retention}
                loading={updateRetentionMutation.isPending}
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
                }}
                disabled={!canRenameApp}
                className="w-96" />
              <Button
                variant="outline"
                disabled={!canRenameApp || saveAppNameButtonDisabled || changeAppNameMutation.isPending}
                className="m-4"
                loading={changeAppNameMutation.isPending}
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
              <Button
                variant="destructive"
                disabled={!canRotateApiKey || changeAppApiKeyMutation.isPending}
                className="mx-4 my-3"
                loading={changeAppApiKeyMutation.isPending}
                onClick={() => setAppApiKeyConfirmationDialogOpen(true)}>
                Rotate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
