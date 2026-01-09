"use client"

import { SdkConfig, UpdateSdkConfigApiStatus, updateSdkConfigFromServer } from "@/app/api/api_calls"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/app/components/accordion"
import { Button } from "@/app/components/button"
import DropdownSelect, { DropdownSelectType } from "@/app/components/dropdown_select"
import NumericInput from "@/app/components/numeric_input"
import { Switch } from "@/app/components/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/tooltip"
import { toastNegative, toastPositive } from "@/app/utils/use_toast"
import { Info } from "lucide-react"
import { useEffect, useState } from 'react'
import DangerConfirmationDialog from "./danger_confirmation_dialog"

interface SdkConfigSectionProps {
  appId: string
  appName: string
  initialConfig: SdkConfig
  currentUserCanChangeAppSettings: boolean
  osName?: string | null
}

const TOOLTIP_STYLE = {
  content: 'max-w-96 bg-neutral-800 fill-neutral-800 text-sm text-white',
  innerWrapper: 'p-2'
} as const

const TEXTAREA_CLASS = "w-full max-h-40 py-2 px-4 border border-black rounded-md font-body text-sm placeholder:text-neutral-400 outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 resize-none overflow-auto"

export default function SdkConfigSection({ appId, appName, initialConfig, currentUserCanChangeAppSettings, osName }: SdkConfigSectionProps) {
  const [sdkConfig, setSdkConfig] = useState<SdkConfig>(initialConfig)
  const [originalSdkConfig, setOriginalSdkConfig] = useState<SdkConfig>(initialConfig)

  // Track changes per section
  const [crashesChanged, setCrashesChanged] = useState(false)
  const [anrsChanged, setAnrsChanged] = useState(false)
  const [bugReportsChanged, setBugReportsChanged] = useState(false)
  const [tracesChanged, setTracesChanged] = useState(false)
  const [launchMetricsChanged, setLaunchMetricsChanged] = useState(false)
  const [journeyChanged, setJourneyChanged] = useState(false)
  const [httpChanged, setHttpChanged] = useState(false)
  const [screenshotMaskingChanged, setScreenshotMaskingChanged] = useState(false)

  // Track save status per section
  const [crashesSaveStatus, setCrashesSaveStatus] = useState(UpdateSdkConfigApiStatus.Init)
  const [anrsSaveStatus, setAnrsSaveStatus] = useState(UpdateSdkConfigApiStatus.Init)
  const [bugReportsSaveStatus, setBugReportsSaveStatus] = useState(UpdateSdkConfigApiStatus.Init)
  const [tracesSaveStatus, setTracesSaveStatus] = useState(UpdateSdkConfigApiStatus.Init)
  const [launchSaveStatus, setLaunchSaveStatus] = useState(UpdateSdkConfigApiStatus.Init)
  const [journeySaveStatus, setJourneySaveStatus] = useState(UpdateSdkConfigApiStatus.Init)
  const [httpSaveStatus, setHttpSaveStatus] = useState(UpdateSdkConfigApiStatus.Init)
  const [maskingSaveStatus, setMaskingSaveStatus] = useState(UpdateSdkConfigApiStatus.Init)

  // Confirmation dialog states
  const [crashesConfirmOpen, setCrashesConfirmOpen] = useState(false)
  const [anrsConfirmOpen, setAnrsConfirmOpen] = useState(false)
  const [bugReportsConfirmOpen, setBugReportsConfirmOpen] = useState(false)
  const [tracesConfirmOpen, setTracesConfirmOpen] = useState(false)
  const [launchConfirmOpen, setLaunchConfirmOpen] = useState(false)
  const [journeyConfirmOpen, setJourneyConfirmOpen] = useState(false)
  const [httpConfirmOpen, setHttpConfirmOpen] = useState(false)
  const [maskingConfirmOpen, setMaskingConfirmOpen] = useState(false)

  // Update local state when initialConfig changes
  useEffect(() => {
    setSdkConfig(initialConfig)
    setOriginalSdkConfig(initialConfig)
  }, [initialConfig])

  // Track changes per section
  useEffect(() => {
    setCrashesChanged(
      sdkConfig.crash_take_screenshot !== originalSdkConfig.crash_take_screenshot ||
      sdkConfig.crash_timeline_duration !== originalSdkConfig.crash_timeline_duration
    )
  }, [sdkConfig.crash_take_screenshot, sdkConfig.crash_timeline_duration,
  originalSdkConfig.crash_take_screenshot, originalSdkConfig.crash_timeline_duration])

  useEffect(() => {
    setAnrsChanged(
      sdkConfig.anr_take_screenshot !== originalSdkConfig.anr_take_screenshot ||
      sdkConfig.anr_timeline_duration !== originalSdkConfig.anr_timeline_duration
    )
  }, [sdkConfig.anr_take_screenshot, sdkConfig.anr_timeline_duration,
  originalSdkConfig.anr_take_screenshot, originalSdkConfig.anr_timeline_duration])

  useEffect(() => {
    setBugReportsChanged(
      sdkConfig.bug_report_timeline_duration !== originalSdkConfig.bug_report_timeline_duration
    )
  }, [sdkConfig.bug_report_timeline_duration, originalSdkConfig.bug_report_timeline_duration])

  useEffect(() => {
    setTracesChanged(sdkConfig.trace_sampling_rate !== originalSdkConfig.trace_sampling_rate)
  }, [sdkConfig.trace_sampling_rate, originalSdkConfig.trace_sampling_rate])

  useEffect(() => {
    setLaunchMetricsChanged(
      sdkConfig.launch_sampling_rate !== originalSdkConfig.launch_sampling_rate
    )
  }, [sdkConfig.launch_sampling_rate, originalSdkConfig.launch_sampling_rate])

  useEffect(() => {
    setJourneyChanged(sdkConfig.journey_sampling_rate !== originalSdkConfig.journey_sampling_rate)
  }, [sdkConfig.journey_sampling_rate, originalSdkConfig.journey_sampling_rate])

  useEffect(() => {
    setHttpChanged(
      JSON.stringify(sdkConfig.http_disable_event_for_urls) !== JSON.stringify(originalSdkConfig.http_disable_event_for_urls) ||
      JSON.stringify(sdkConfig.http_track_request_for_urls) !== JSON.stringify(originalSdkConfig.http_track_request_for_urls) ||
      JSON.stringify(sdkConfig.http_track_response_for_urls) !== JSON.stringify(originalSdkConfig.http_track_response_for_urls) ||
      JSON.stringify(sdkConfig.http_blocked_headers) !== JSON.stringify(originalSdkConfig.http_blocked_headers)
    )
  }, [sdkConfig.http_disable_event_for_urls, sdkConfig.http_track_request_for_urls,
  sdkConfig.http_track_response_for_urls, sdkConfig.http_blocked_headers,
  originalSdkConfig.http_disable_event_for_urls, originalSdkConfig.http_track_request_for_urls,
  originalSdkConfig.http_track_response_for_urls, originalSdkConfig.http_blocked_headers])

  useEffect(() => {
    setScreenshotMaskingChanged(sdkConfig.screenshot_mask_level !== originalSdkConfig.screenshot_mask_level)
  }, [sdkConfig.screenshot_mask_level, originalSdkConfig.screenshot_mask_level])

  const saveSdkConfigSection = async (
    section: 'traces' | 'crashes' | 'anrs' | 'bug_reports' | 'launch_metrics' | 'journey' | 'masking' | 'http',
    setSaveStatus: (status: UpdateSdkConfigApiStatus) => void
  ) => {
    setSaveStatus(UpdateSdkConfigApiStatus.Loading)

    // Build the config object with only the fields for this section
    let configToSave: Partial<SdkConfig> = {}

    switch (section) {
      case 'crashes':
        configToSave = {
          crash_take_screenshot: sdkConfig.crash_take_screenshot,
          crash_timeline_duration: sdkConfig.crash_timeline_duration
        }
        break
      case 'anrs':
        configToSave = {
          anr_take_screenshot: sdkConfig.anr_take_screenshot,
          anr_timeline_duration: sdkConfig.anr_timeline_duration
        }
        break
      case 'bug_reports':
        configToSave = {
          bug_report_timeline_duration: sdkConfig.bug_report_timeline_duration
        }
        break
      case 'traces':
        configToSave = {
          trace_sampling_rate: sdkConfig.trace_sampling_rate
        }
        break
      case 'launch_metrics':
        configToSave = {
          launch_sampling_rate: sdkConfig.launch_sampling_rate
        }
        break
      case 'journey':
        configToSave = {
          journey_sampling_rate: sdkConfig.journey_sampling_rate
        }
        break
      case 'http':
        configToSave = {
          http_disable_event_for_urls: sdkConfig.http_disable_event_for_urls,
          http_track_request_for_urls: sdkConfig.http_track_request_for_urls,
          http_track_response_for_urls: sdkConfig.http_track_response_for_urls,
          http_blocked_headers: sdkConfig.http_blocked_headers
        }
        break
      case 'masking':
        configToSave = {
          screenshot_mask_level: sdkConfig.screenshot_mask_level
        }
        break
    }

    const result = await updateSdkConfigFromServer(appId, configToSave as SdkConfig)

    switch (result.status) {
      case UpdateSdkConfigApiStatus.Error:
        setSaveStatus(UpdateSdkConfigApiStatus.Error)
        toastNegative("Error saving configuration", result.error)
        break
      case UpdateSdkConfigApiStatus.Success:
        setSaveStatus(UpdateSdkConfigApiStatus.Success)
        // Update original config with only the saved values
        setOriginalSdkConfig(prev => ({
          ...prev,
          ...configToSave
        }))
        toastPositive("Configuration saved")
        break
      case UpdateSdkConfigApiStatus.Cancelled:
        setSaveStatus(UpdateSdkConfigApiStatus.Init)
        break
    }
  }

  const saveCrashes = () => saveSdkConfigSection('crashes', setCrashesSaveStatus)
  const saveAnrs = () => saveSdkConfigSection('anrs', setAnrsSaveStatus)
  const saveBugReports = () => saveSdkConfigSection('bug_reports', setBugReportsSaveStatus)
  const saveTraces = () => saveSdkConfigSection('traces', setTracesSaveStatus)
  const saveLaunch = () => saveSdkConfigSection('launch_metrics', setLaunchSaveStatus)
  const saveJourney = () => saveSdkConfigSection('journey', setJourneySaveStatus)
  const saveHttp = () => saveSdkConfigSection('http', setHttpSaveStatus)
  const saveMasking = () => saveSdkConfigSection('masking', setMaskingSaveStatus)

  const arrayToInput = (arr: string[]): string => {
    if (!arr || arr.length === 0) return ''
    return arr.join('\n')
  }

  const inputToArray = (str: string): string[] => {
    if (!str || str.trim() === '') return []
    return str.split('\n').map(line => line.trim()).filter(line => line !== '')
  }

  // Convert mask level to display format, must be in sync with displayToMaskLevel.
  const maskLevelToDisplay = (maskLevel: string): string => {
    const map: { [key: string]: string } = {
      'all_text_and_media': 'All text and media',
      'all_text': 'All text',
      'all_text_except_clickable': 'All text except clickable',
      'sensitive_fields_only': 'Sensitive fields only',
    }
    return map[maskLevel]
  }

  // Convert display format to mask level, must be in sync with maskLevelToDisplay.
  const displayToMaskLevel = (display: string): string => {
    const map: { [key: string]: string } = {
      'All text and media': 'all_text_and_media',
      'All text': 'all_text',
      'All text except clickable': 'all_text_except_clickable',
      'Sensitive fields only': 'sensitive_fields_only',
    }
    return map[display] || 'sensitive_fields_only'
  }

  const getUrlPlaceholder = () => [
    "https://api.example.com/v1/public/*",
    "https://example.com/*/health",
  ].join('\n')

  const getHeaderPlaceholder = () => [
    "X-User-ID",
    "X-API-Key",
  ].join('\n')

  // Helper to check if ANR should be shown
  const shouldShowAnr = osName === null || osName === undefined || osName.toLowerCase() === 'android'

  // Confirmation dialog body generators
  const getCrashesConfirmBody = () => {
    return (
      <div className="font-body">
        <p>Are you sure you want to update <span className="font-display font-bold">Crash settings</span> for app <span className="font-display font-bold">{appName}</span>?</p>
        <p className="mt-4">The following changes will be applied:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          {sdkConfig.crash_take_screenshot !== originalSdkConfig.crash_take_screenshot && (
            <li>Screenshot with crash <span className="font-display font-bold">{sdkConfig.crash_take_screenshot ? 'Enabled' : 'Disabled'}</span></li>
          )}
          {sdkConfig.crash_timeline_duration !== originalSdkConfig.crash_timeline_duration && (
            <li>Session Timeline duration: <span className="font-display font-bold">{originalSdkConfig.crash_timeline_duration} seconds</span> → <span className="font-display font-bold">{sdkConfig.crash_timeline_duration} seconds</span></li>
          )}
        </ul>
        <p className="mt-4">These changes will apply to all new crashes.</p>
      </div>
    )
  }

  const getAnrsConfirmBody = () => {
    return (
      <div className="font-body">
        <p>Are you sure you want to update <span className="font-display font-bold">ANR settings</span> for app <span className="font-display font-bold">{appName}</span>?</p>
        <p className="mt-4">The following changes will be applied:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          {sdkConfig.anr_take_screenshot !== originalSdkConfig.anr_take_screenshot && (
            <li>Screenshot with ANR: <span className="font-display font-bold">{sdkConfig.anr_take_screenshot ? 'Enabled' : 'Disabled'}</span></li>
          )}
          {sdkConfig.anr_timeline_duration !== originalSdkConfig.anr_timeline_duration && (
            <li>Session timeline duration: <span className="font-display font-bold">{originalSdkConfig.anr_timeline_duration} seconds</span> → <span className="font-display font-bold">{sdkConfig.anr_timeline_duration} seconds</span></li>
          )}
        </ul>
        <p className="mt-4">These changes will apply to all new ANRs.</p>
      </div>
    )
  }

  const getBugReportsConfirmBody = () => {
    return (
      <div className="font-body">
        <p>Are you sure you want to update <span className="font-display font-bold">Bug Report settings</span> for app <span className="font-display font-bold">{appName}</span>?</p>
        <p className="mt-4">The following changes will be applied:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Session timeline duration: <span className="font-display font-bold">{originalSdkConfig.bug_report_timeline_duration} seconds</span> → <span className="font-display font-bold">{sdkConfig.bug_report_timeline_duration} seconds</span></li>
        </ul>
        <p className="mt-4">These changes will apply to all new bug reports.</p>
      </div>
    )
  }

  const getTracesConfirmBody = () => {
    return (
      <div className="font-body">
        <p>Are you sure you want to update <span className="font-display font-bold">Trace settings</span> for app <span className="font-display font-bold">{appName}</span>?</p>
        <p className="mt-4">The following changes will be applied:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Sampling rate: <span className="font-display font-bold">{originalSdkConfig.trace_sampling_rate}%</span> → <span className="font-display font-bold">{sdkConfig.trace_sampling_rate}%</span></li>
        </ul>
        <p className="mt-4">These changes will apply to all new traces.</p>
      </div>
    )
  }

  const getLaunchConfirmBody = () => {
    return (
      <div className="font-body">
        <p>Are you sure you want to update <span className="font-display font-bold">Launch Metrics settings</span> for app <span className="font-display font-bold">{appName}</span>?</p>
        <p className="mt-4">The following changes will be applied:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Sampling rate: <span className="font-display font-bold">{originalSdkConfig.launch_sampling_rate}%</span> → <span className="font-display font-bold">{sdkConfig.launch_sampling_rate}%</span></li>
        </ul>
        <p className="mt-4">These changes will apply to all new launches.</p>
      </div>
    )
  }

  const getJourneysConfirmBody = () => {
    return (
      <div className="font-body">
        <p>Are you sure you want to update <span className="font-display font-bold">User Journey settings</span> for app <span className="font-display font-bold">{appName}</span>?</p>
        <p className="mt-4">The following changes will be applied:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Sampling rate: <span className="font-display font-bold">{originalSdkConfig.journey_sampling_rate}%</span> → <span className="font-display font-bold">{sdkConfig.journey_sampling_rate}%</span></li>
        </ul>
        <p className="mt-4">These changes will apply to all new sessions.</p>
      </div>
    )
  }

  const getHttpConfirmBody = () => {
    return (
      <div className="font-body">
        <p>Are you sure you want to update <span className="font-display font-bold">HTTP collection settings</span> for app <span className="font-display font-bold">{appName}</span>?</p>
        <p className="mt-4">The following configurations will be updated:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          {JSON.stringify(sdkConfig.http_disable_event_for_urls) !== JSON.stringify(originalSdkConfig.http_disable_event_for_urls) && (
            <li>Disabled HTTP events for URLs</li>
          )}
          {JSON.stringify(sdkConfig.http_track_request_for_urls) !== JSON.stringify(originalSdkConfig.http_track_request_for_urls) && (
            <li>Collect request for URLs</li>
          )}
          {JSON.stringify(sdkConfig.http_track_response_for_urls) !== JSON.stringify(originalSdkConfig.http_track_response_for_urls) && (
            <li>Collect response for URLs</li>
          )}
          {JSON.stringify(sdkConfig.http_blocked_headers) !== JSON.stringify(originalSdkConfig.http_blocked_headers) && (
            <li>Blocked headers</li>
          )}
        </ul>
        <p className="mt-4">These changes will apply to all new HTTP requests.</p>
      </div>
    )
  }

  const getMaskingConfirmBody = () => {
    return (
      <div className="font-body">
        <p>Are you sure you want to update <span className="font-display font-bold">Screenshot Masking settings</span> for app <span className="font-display font-bold">{appName}</span>?</p>
        <p className="mt-4">The following changes will be applied:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Mask level: <span className="font-display font-bold">{maskLevelToDisplay(originalSdkConfig.screenshot_mask_level)}</span> → <span className="font-display font-bold">{maskLevelToDisplay(sdkConfig.screenshot_mask_level)}</span></li>
        </ul>
        <p className="mt-4">These changes will apply to all new screenshots.</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <p className="max-w-6xl font-display text-xl">Configure data collection</p>
      <p className="mt-2 font-body text-xs text-gray-600">
        See the <a href="https://github.com/measure-sh/measure/blob/main/docs/features/configuration-options.md" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 decoration-2 decoration-yellow-200 hover:decoration-yellow-500">docs</a> to learn more
      </p>

      <div className="mt-6">
        <Accordion type="single" collapsible className="w-full">
          {/* Crashes Accordion */}
          <AccordionItem value="crashes" className="mt-2">
            <AccordionTrigger className="font-body text-base">Crashes</AccordionTrigger>
            <AccordionContent className="px-4 py-4 bg-gray-50">
              <div className="mt-4 space-y-6">
                <div className="flex flex-col gap-3 min-h-[2.5rem] sm:flex-row sm:items-center sm:gap-0">
                  <p className="text-sm">Collect screenshot with crashes</p>
                  <Switch
                    data-testid="crash-screenshot-switch"
                    className="sm:ml-3 data-[state=checked]:bg-emerald-500"
                    checked={sdkConfig.crash_take_screenshot}
                    onCheckedChange={(checked) => setSdkConfig({ ...sdkConfig, crash_take_screenshot: checked })}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm">Collect session timeline of</span>
                  <NumericInput
                    testId="crash-timeline-duration-input"
                    value={sdkConfig.crash_timeline_duration}
                    minValue={0}
                    maxValue={3600}
                    onChange={(val) => setSdkConfig({ ...sdkConfig, crash_timeline_duration: val })}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                  <span className="font-body text-sm">seconds with every crash</span>
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    data-testid="crashes-save-button"
                    variant="outline"
                    className="border border-black font-display select-none"
                    disabled={!currentUserCanChangeAppSettings || !crashesChanged}
                    loading={crashesSaveStatus === UpdateSdkConfigApiStatus.Loading}
                    onClick={() => setCrashesConfirmOpen(true)}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ANRs Accordion */}
          {shouldShowAnr && (
            <AccordionItem value="anrs" className="mt-2">
              <AccordionTrigger className="font-body text-base">ANRs</AccordionTrigger>
              <AccordionContent className="px-4 py-4 bg-gray-50">
                <div className="mt-4 space-y-6">
                  <div className="flex flex-col gap-3 min-h-[2.5rem] sm:flex-row sm:items-center sm:gap-0">
                    <p className="text-sm">Collect screenshot with ANRs</p>
                    <Switch
                      data-testid="anr-screenshot-switch"
                      className="sm:ml-3 data-[state=checked]:bg-emerald-500"
                      checked={sdkConfig.anr_take_screenshot}
                      onCheckedChange={(checked) => setSdkConfig({ ...sdkConfig, anr_take_screenshot: checked })}
                      disabled={!currentUserCanChangeAppSettings}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-body text-sm">Collect session timeline of</span>
                    <NumericInput
                      testId="anr-timeline-duration-input"
                      value={sdkConfig.anr_timeline_duration}
                      minValue={0}
                      maxValue={3600}
                      onChange={(val) => setSdkConfig({ ...sdkConfig, anr_timeline_duration: val })}
                      disabled={!currentUserCanChangeAppSettings}
                    />
                    <span className="font-body text-sm">seconds with every ANR</span>
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button
                      data-testid="anrs-save-button"
                      variant="outline"
                      className="border border-black font-display select-none"
                      disabled={!currentUserCanChangeAppSettings || !anrsChanged}
                      loading={anrsSaveStatus === UpdateSdkConfigApiStatus.Loading}
                      onClick={() => setAnrsConfirmOpen(true)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Bug Reports Accordion */}
          <AccordionItem value="bug_reports" className="mt-2">
            <AccordionTrigger className="font-body text-base">Bug Reports</AccordionTrigger>
            <AccordionContent className="px-4 py-4 bg-gray-50">
              <div className="mt-4 space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm">Collect session timeline of</span>
                  <NumericInput
                    testId="bug-report-timeline-duration-input"
                    value={sdkConfig.bug_report_timeline_duration}
                    minValue={0}
                    maxValue={3600}
                    onChange={(val) => setSdkConfig({ ...sdkConfig, bug_report_timeline_duration: val })}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                  <span className="font-body text-sm">seconds with every Bug Report</span>
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    data-testid="bug-reports-save-button"
                    variant="outline"
                    className="border border-black font-display select-none"
                    disabled={!currentUserCanChangeAppSettings || !bugReportsChanged}
                    loading={bugReportsSaveStatus === UpdateSdkConfigApiStatus.Loading}
                    onClick={() => setBugReportsConfirmOpen(true)}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Traces Accordion */}
          <AccordionItem value="traces" className="mt-2">
            <AccordionTrigger className="font-body text-base">Traces</AccordionTrigger>
            <AccordionContent className="px-4 py-4 bg-gray-50">
              <div className="mt-4 space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm">Collect traces at</span>
                  <NumericInput
                    testId="trace-sampling-rate-input"
                    value={sdkConfig.trace_sampling_rate}
                    minValue={0}
                    maxValue={100}
                    step={0.01}
                    type="float"
                    onChange={(value) => setSdkConfig({ ...sdkConfig, trace_sampling_rate: value })}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                  <span className="font-body text-sm">% sampling rate</span>
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    data-testid="traces-save-button"
                    variant="outline"
                    className="border border-black font-display select-none"
                    disabled={!currentUserCanChangeAppSettings || !tracesChanged}
                    loading={tracesSaveStatus === UpdateSdkConfigApiStatus.Loading}
                    onClick={() => setTracesConfirmOpen(true)}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Launch Metrics Accordion */}
          <AccordionItem value="launch" className="mt-2">
            <AccordionTrigger className="font-body text-base">Launch Metrics</AccordionTrigger>
            <AccordionContent className="px-4 py-4 bg-gray-50">
              <div className="mt-4 space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm">Collect cold, warm and hot launch metrics at</span>
                  <NumericInput
                    testId="launch-sampling-rate-input"
                    value={sdkConfig.launch_sampling_rate}
                    minValue={0}
                    maxValue={100}
                    step={0.01}
                    type="float"
                    onChange={(value) => setSdkConfig({ ...sdkConfig, launch_sampling_rate: value })}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                  <span className="font-body text-sm">% sampling rate</span>
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    data-testid="launch-save-button"
                    variant="outline"
                    className="border border-black font-display select-none"
                    disabled={!currentUserCanChangeAppSettings || !launchMetricsChanged}
                    loading={launchSaveStatus === UpdateSdkConfigApiStatus.Loading}
                    onClick={() => setLaunchConfirmOpen(true)}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* User Journeys Accordion */}
          <AccordionItem value="journeys" className="mt-2">
            <AccordionTrigger className="font-body text-base">User Journeys</AccordionTrigger>
            <AccordionContent className="px-4 py-4 bg-gray-50">
              <div className="mt-4 space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm">Collect user journeys for</span>
                  <NumericInput
                    testId="journey-sampling-rate-input"
                    value={sdkConfig.journey_sampling_rate}
                    minValue={0}
                    maxValue={100}
                    step={0.01}
                    type="float"
                    onChange={(value) => setSdkConfig({ ...sdkConfig, journey_sampling_rate: value })}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                  <span className="font-body text-sm">% sessions</span>
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    data-testid="journey-save-button"
                    variant="outline"
                    className="border border-black font-display select-none"
                    disabled={!currentUserCanChangeAppSettings || !journeyChanged}
                    loading={journeySaveStatus === UpdateSdkConfigApiStatus.Loading}
                    onClick={() => setJourneyConfirmOpen(true)}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* HTTP Accordion */}
          <AccordionItem value="http" className="mt-2">
            <AccordionTrigger className="font-body text-base">HTTP</AccordionTrigger>
            <AccordionContent className="px-4 py-4 bg-gray-50">
              <div className="mt-4 space-y-8">
                {/* Disable HTTP event for URLs */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display text-base">Disable HTTP event for URLs</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex items-center -mt-0.5">
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className={TOOLTIP_STYLE.content}>
                        <div className={TOOLTIP_STYLE.innerWrapper}>
                          HTTP events will not be collected for URLs matching these patterns. Supports exact match and wildcards (*). Enter one pattern per line.
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <textarea
                    data-testid="http-disable-urls-textarea"
                    rows={4}
                    value={arrayToInput(sdkConfig.http_disable_event_for_urls)}
                    onChange={(e) => setSdkConfig({ ...sdkConfig, http_disable_event_for_urls: inputToArray(e.target.value) })}
                    placeholder={getUrlPlaceholder()}
                    className={TEXTAREA_CLASS}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>

                {/* Track Request for URLs */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display text-base">Track request for URLs</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex items-center -mt-0.5">
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className={TOOLTIP_STYLE.content}>
                        <div className={TOOLTIP_STYLE.innerWrapper}>
                          Full HTTP request (body and headers) will be captured for URLs matching these patterns. Supports exact match and wildcards (*). Enter one pattern per line.
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <textarea
                    data-testid="http-track-request-urls-textarea"
                    rows={4}
                    value={arrayToInput(sdkConfig.http_track_request_for_urls)}
                    onChange={(e) => setSdkConfig({ ...sdkConfig, http_track_request_for_urls: inputToArray(e.target.value) })}
                    placeholder={getUrlPlaceholder()}
                    className={TEXTAREA_CLASS}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>

                {/* Track Response for URLs */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display text-base">Track response for URLs</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex items-center -mt-0.5">
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className={TOOLTIP_STYLE.content}>
                        <div className={TOOLTIP_STYLE.innerWrapper}>
                          Full HTTP response (body and headers) will be captured for URLs matching these patterns. Supports exact match and wildcards (*). Enter one pattern per line.
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <textarea
                    data-testid="http-track-response-urls-textarea"
                    rows={4}
                    value={arrayToInput(sdkConfig.http_track_response_for_urls)}
                    onChange={(e) => setSdkConfig({ ...sdkConfig, http_track_response_for_urls: inputToArray(e.target.value) })}
                    placeholder={getUrlPlaceholder()}
                    className={TEXTAREA_CLASS}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>

                {/* Blocked Headers */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display text-base">Blocked headers</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex items-center -mt-0.5">
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className={TOOLTIP_STYLE.content}>
                        <div className={TOOLTIP_STYLE.innerWrapper}>
                          Headers that will never be captured in HTTP requests or responses. Note that common sensitive headers like Authorization, Cookies, etc are never collected by default. Enter one header name per line.
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <textarea
                    data-testid="http-blocked-headers-textarea"
                    rows={4}
                    value={arrayToInput(sdkConfig.http_blocked_headers)}
                    onChange={(e) => setSdkConfig({ ...sdkConfig, http_blocked_headers: inputToArray(e.target.value) })}
                    placeholder={getHeaderPlaceholder()}
                    className={TEXTAREA_CLASS}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>

                <div className="flex justify-end mt-2">
                  <Button
                    data-testid="http-save-button"
                    variant="outline"
                    className="border border-black font-display select-none"
                    disabled={!currentUserCanChangeAppSettings || !httpChanged}
                    loading={httpSaveStatus === UpdateSdkConfigApiStatus.Loading}
                    onClick={() => setHttpConfirmOpen(true)}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Screenshot Masking Accordion */}
          <AccordionItem value="masking" className="mt-2">
            <AccordionTrigger className="font-body text-base">Screenshot Masking</AccordionTrigger>
            <AccordionContent className="px-4 py-4 bg-gray-50">
              <div className="mt-4 space-y-6">
                <div className="flex flex-col gap-3 min-h-[2.5rem] sm:flex-row sm:items-center sm:gap-0">
                  <p className="text-sm">Screenshot mask level</p>
                  <div className="sm:ml-3">
                    <DropdownSelect
                      data-testid="screenshot-mask-level-dropdown"
                      type={DropdownSelectType.SingleString}
                      title=""
                      items={['All text and media', 'All text', 'All text except clickable', 'Sensitive fields only']}
                      initialSelected={maskLevelToDisplay(sdkConfig.screenshot_mask_level)}
                      onChangeSelected={(item) => setSdkConfig({ ...sdkConfig, screenshot_mask_level: displayToMaskLevel(item as string) })}
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    data-testid="masking-save-button"
                    variant="outline"
                    className="border border-black font-display select-none"
                    disabled={!currentUserCanChangeAppSettings || !screenshotMaskingChanged}
                    loading={maskingSaveStatus === UpdateSdkConfigApiStatus.Loading}
                    onClick={() => setMaskingConfirmOpen(true)}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Confirmation Dialogs */}
      <DangerConfirmationDialog
        body={getCrashesConfirmBody()}
        open={crashesConfirmOpen}
        affirmativeText="Yes, I'm sure"
        cancelText="Cancel"
        onAffirmativeAction={() => {
          setCrashesConfirmOpen(false)
          saveCrashes()
        }}
        onCancelAction={() => setCrashesConfirmOpen(false)}
      />

      {shouldShowAnr && (
        <DangerConfirmationDialog
          body={getAnrsConfirmBody()}
          open={anrsConfirmOpen}
          affirmativeText="Yes, I'm sure"
          cancelText="Cancel"
          onAffirmativeAction={() => {
            setAnrsConfirmOpen(false)
            saveAnrs()
          }}
          onCancelAction={() => setAnrsConfirmOpen(false)}
        />
      )}

      <DangerConfirmationDialog
        body={getBugReportsConfirmBody()}
        open={bugReportsConfirmOpen}
        affirmativeText="Yes, I'm sure"
        cancelText="Cancel"
        onAffirmativeAction={() => {
          setBugReportsConfirmOpen(false)
          saveBugReports()
        }}
        onCancelAction={() => setBugReportsConfirmOpen(false)}
      />

      <DangerConfirmationDialog
        body={getTracesConfirmBody()}
        open={tracesConfirmOpen}
        affirmativeText="Yes, I'm sure"
        cancelText="Cancel"
        onAffirmativeAction={() => {
          setTracesConfirmOpen(false)
          saveTraces()
        }}
        onCancelAction={() => setTracesConfirmOpen(false)}
      />

      <DangerConfirmationDialog
        body={getLaunchConfirmBody()}
        open={launchConfirmOpen}
        affirmativeText="Yes, I'm sure"
        cancelText="Cancel"
        onAffirmativeAction={() => {
          setLaunchConfirmOpen(false)
          saveLaunch()
        }}
        onCancelAction={() => setLaunchConfirmOpen(false)}
      />

      <DangerConfirmationDialog
        body={getJourneysConfirmBody()}
        open={journeyConfirmOpen}
        affirmativeText="Yes, I'm sure"
        cancelText="Cancel"
        onAffirmativeAction={() => {
          setJourneyConfirmOpen(false)
          saveJourney()
        }}
        onCancelAction={() => setJourneyConfirmOpen(false)}
      />

      <DangerConfirmationDialog
        body={getHttpConfirmBody()}
        open={httpConfirmOpen}
        affirmativeText="Yes, I'm sure"
        cancelText="Cancel"
        onAffirmativeAction={() => {
          setHttpConfirmOpen(false)
          saveHttp()
        }}
        onCancelAction={() => setHttpConfirmOpen(false)}
      />

      <DangerConfirmationDialog
        body={getMaskingConfirmBody()}
        open={maskingConfirmOpen}
        affirmativeText="Yes, I'm sure"
        cancelText="Cancel"
        onAffirmativeAction={() => {
          setMaskingConfirmOpen(false)
          saveMasking()
        }}
        onCancelAction={() => setMaskingConfirmOpen(false)}
      />
    </div>
  )
}