"use client"

import { SdkConfig, UpdateSdkConfigApiStatus, updateSdkConfigFromServer } from "@/app/api/api_calls"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/app/components/accordion"
import { Button } from "@/app/components/button"
import DropdownSelect, { DropdownSelectType } from "@/app/components/dropdown_select"
import SdkConfigNumericInput from "@/app/components/sdk_config_numeric_input"
import { Switch } from "@/app/components/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/tooltip"
import { toastNegative, toastPositive } from "@/app/utils/use_toast"
import { Info } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from 'react'
import { underlineLinkStyle } from "../utils/shared_styles"
import DangerConfirmationDialog from "./danger_confirmation_dialog"
import { Textarea } from "./textarea"

interface SdkConfiguratorProps {
  appId: string
  appName: string
  initialConfig: SdkConfig
  currentUserCanChangeAppSettings: boolean
  osName?: string | null
}

const accordionContentStyle = 'p-4'

export default function SdkConfigurator({ appId, appName, initialConfig, currentUserCanChangeAppSettings, osName }: SdkConfiguratorProps) {
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
          http_disable_event_for_urls: sdkConfig.http_disable_event_for_urls.filter(url => url.trim() !== ""),
          http_track_request_for_urls: sdkConfig.http_track_request_for_urls.filter(url => url.trim() !== ""),
          http_track_response_for_urls: sdkConfig.http_track_response_for_urls.filter(url => url.trim() !== ""),
          http_blocked_headers: sdkConfig.http_blocked_headers.filter(header => header.trim() !== "")
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
    return str.split('\n').map(line => line.trim())
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

  const preventSpaceKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === ' ') {
      e.preventDefault()
    }
  }

  return (
    <div className="w-full">
      <p className="max-w-6xl font-display text-xl">Configure Data Collection</p>
      <p className="mt-2 font-body text-xs text-muted-foreground">
        See the <Link href="https://github.com/measure-sh/measure/blob/main/docs/features/configuration-options.md" target="_blank" className={underlineLinkStyle}>docs</Link> to learn more
      </p>

      <div className="mt-6">
        <Accordion type="single" collapsible className="w-full">
          {/* Crashes Accordion */}
          <AccordionItem value="crashes" className="mt-2">
            <AccordionTrigger className="font-body text-base">Crashes</AccordionTrigger>
            <AccordionContent className={accordionContentStyle}>
              <div className="mt-2 space-y-4">
                <div className="flex flex-col gap-2 min-h-[2.5rem] sm:flex-row sm:items-center sm:gap-0">
                  <p className="text-sm">Collect screenshot with crashes</p>
                  <Switch
                    data-testid="crash-screenshot-switch"
                    className="sm:ml-4"
                    checked={sdkConfig.crash_take_screenshot}
                    onCheckedChange={(checked) => setSdkConfig({ ...sdkConfig, crash_take_screenshot: checked })}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm">Collect session timeline of</span>
                  <SdkConfigNumericInput
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
              <AccordionContent className={accordionContentStyle}>
                <div className="mt-2 space-y-4">
                  <div className="flex flex-col gap-2 min-h-[2.5rem] sm:flex-row sm:items-center sm:gap-0">
                    <p className="text-sm">Collect screenshot with ANRs</p>
                    <Switch
                      data-testid="anr-screenshot-switch"
                      className="sm:ml-4"
                      checked={sdkConfig.anr_take_screenshot}
                      onCheckedChange={(checked) => setSdkConfig({ ...sdkConfig, anr_take_screenshot: checked })}
                      disabled={!currentUserCanChangeAppSettings}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-body text-sm">Collect session timeline of</span>
                    <SdkConfigNumericInput
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
            <AccordionContent className={accordionContentStyle}>
              <div className="mt-2 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm">Collect session timeline of</span>
                  <SdkConfigNumericInput
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
            <AccordionContent className={accordionContentStyle}>
              <div className="mt-2 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm">Collect traces at</span>
                  <SdkConfigNumericInput
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
            <AccordionContent className={accordionContentStyle}>
              <div className="mt-2 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm">Collect cold, warm and hot launch metrics at</span>
                  <SdkConfigNumericInput
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
            <AccordionContent className={accordionContentStyle}>
              <div className="mt-2 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm">Collect user journeys for</span>
                  <SdkConfigNumericInput
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
            <AccordionContent className={accordionContentStyle}>
              <div className="mt-2 space-y-4">
                {/* Disable HTTP event for URLs */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display">Disable HTTP event for URLs</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 -mt-0.5" />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="font-display max-w-96 text-sm text-accent-foreground fill-accent bg-accent">
                        HTTP events will not be collected for URLs matching these patterns. Supports exact match and wildcards (*). Enter one pattern per line.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Textarea
                    data-testid="http-disable-urls-textarea"
                    rows={4}
                    value={arrayToInput(sdkConfig.http_disable_event_for_urls)}
                    onChange={(e) => setSdkConfig({ ...sdkConfig, http_disable_event_for_urls: inputToArray(e.target.value) })}
                    onKeyDown={preventSpaceKey}
                    placeholder={getUrlPlaceholder()}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>

                {/* Track Request for URLs */}
                <div className="py-2">
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display">Track request for URLs</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 -mt-0.5" />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="font-display max-w-96 text-sm text-accent-foreground fill-accent bg-accent">
                        Full HTTP request (body and headers) will be captured for URLs matching these patterns. Supports exact match and wildcards (*). Enter one pattern per line.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Textarea
                    data-testid="http-track-request-urls-textarea"
                    rows={4}
                    value={arrayToInput(sdkConfig.http_track_request_for_urls)}
                    onChange={(e) => setSdkConfig({ ...sdkConfig, http_track_request_for_urls: inputToArray(e.target.value) })}
                    onKeyDown={preventSpaceKey}
                    placeholder={getUrlPlaceholder()}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>

                {/* Track Response for URLs */}
                <div className="py-2">
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display">Track response for URLs</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 -mt-0.5" />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="font-display max-w-96 text-sm text-accent-foreground fill-accent bg-accent">
                        Full HTTP response (body and headers) will be captured for URLs matching these patterns. Supports exact match and wildcards (*). Enter one pattern per line.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Textarea
                    data-testid="http-track-response-urls-textarea"
                    rows={4}
                    value={arrayToInput(sdkConfig.http_track_response_for_urls)}
                    onChange={(e) => setSdkConfig({ ...sdkConfig, http_track_response_for_urls: inputToArray(e.target.value) })}
                    onKeyDown={preventSpaceKey}
                    placeholder={getUrlPlaceholder()}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>

                {/* Blocked Headers */}
                <div className="py-2">
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display">Blocked headers</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 -mt-0.5" />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="font-display max-w-96 text-sm text-accent-foreground fill-accent bg-accent">
                        Headers that will never be captured in HTTP requests or responses. Note that common sensitive headers like Authorization, Cookies, etc are never collected by default. Enter one header name per line.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Textarea
                    data-testid="http-blocked-headers-textarea"
                    rows={4}
                    value={arrayToInput(sdkConfig.http_blocked_headers)}
                    onChange={(e) => setSdkConfig({ ...sdkConfig, http_blocked_headers: inputToArray(e.target.value) })}
                    onKeyDown={preventSpaceKey}
                    placeholder={getHeaderPlaceholder()}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>

                <div className="flex justify-end py-2">
                  <Button
                    data-testid="http-save-button"
                    variant="outline"
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
            <AccordionContent className={accordionContentStyle}>
              <div className="mt-2 space-y-4">
                <div className="flex flex-col gap-2 min-h-[2.5rem] sm:flex-row sm:items-center sm:gap-0">
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