"use client"

import { SdkConfig, UpdateSdkConfigApiStatus, updateSdkConfigFromServer } from "@/app/api/api_calls"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/app/components/accordion"
import { Button } from "@/app/components/button"
import DropdownSelect, { DropdownSelectType } from "@/app/components/dropdown_select"
import SamplingRateInput from "@/app/components/sampling_rate_input"
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
  content: 'max-w-96 text-sm text-white fill-neutral-800 bg-neutral-800',
  innerWrapper: 'p-2'
} as const

export default function SdkConfigSection({ appId, appName, initialConfig, currentUserCanChangeAppSettings, osName }: SdkConfigSectionProps) {
  const [sdkConfig, setSdkConfig] = useState<SdkConfig>(initialConfig)
  const [originalSdkConfig, setOriginalSdkConfig] = useState<SdkConfig>(initialConfig)

  // Track changes per section
  const [crashesChanged, setCrashesChanged] = useState(false)
  const [anrsChanged, setAnrsChanged] = useState(false)
  const [tracesChanged, setTracesChanged] = useState(false)
  const [launchMetricsChanged, setLaunchMetricsChanged] = useState(false)
  const [httpChanged, setHttpChanged] = useState(false)
  const [screenshotMaskingChanged, setScreenshotMaskingChanged] = useState(false)

  // Track save status per section
  const [crashesSaveStatus, setCrashesSaveStatus] = useState(UpdateSdkConfigApiStatus.Init)
  const [anrsSaveStatus, setAnrsSaveStatus] = useState(UpdateSdkConfigApiStatus.Init)
  const [tracesSaveStatus, setTracesSaveStatus] = useState(UpdateSdkConfigApiStatus.Init)
  const [launchSaveStatus, setLaunchSaveStatus] = useState(UpdateSdkConfigApiStatus.Init)
  const [httpSaveStatus, setHttpSaveStatus] = useState(UpdateSdkConfigApiStatus.Init)
  const [maskingSaveStatus, setMaskingSaveStatus] = useState(UpdateSdkConfigApiStatus.Init)

  // Confirmation dialog states
  const [crashesConfirmOpen, setCrashesConfirmOpen] = useState(false)
  const [anrsConfirmOpen, setAnrsConfirmOpen] = useState(false)
  const [tracesConfirmOpen, setTracesConfirmOpen] = useState(false)
  const [launchConfirmOpen, setLaunchConfirmOpen] = useState(false)
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
      sdkConfig.crash_timeline_sampling_rate !== originalSdkConfig.crash_timeline_sampling_rate
    )
  }, [sdkConfig.crash_take_screenshot, sdkConfig.crash_timeline_sampling_rate,
  originalSdkConfig.crash_take_screenshot, originalSdkConfig.crash_timeline_sampling_rate])

  useEffect(() => {
    setAnrsChanged(
      sdkConfig.anr_take_screenshot !== originalSdkConfig.anr_take_screenshot ||
      sdkConfig.anr_timeline_sampling_rate !== originalSdkConfig.anr_timeline_sampling_rate
    )
  }, [sdkConfig.anr_take_screenshot, sdkConfig.anr_timeline_sampling_rate,
  originalSdkConfig.anr_take_screenshot, originalSdkConfig.anr_timeline_sampling_rate])

  useEffect(() => {
    setTracesChanged(sdkConfig.trace_sampling_rate !== originalSdkConfig.trace_sampling_rate)
  }, [sdkConfig.trace_sampling_rate, originalSdkConfig.trace_sampling_rate])


  useEffect(() => {
    setLaunchMetricsChanged(
      sdkConfig.launch_sampling_rate !== originalSdkConfig.launch_sampling_rate
    )
  }, [sdkConfig.launch_sampling_rate, originalSdkConfig.launch_sampling_rate])

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
    section: 'traces' | 'crashes' | 'anrs' | 'launch_metrics' | 'masking' | 'http',
    setSaveStatus: (status: UpdateSdkConfigApiStatus) => void
  ) => {
    setSaveStatus(UpdateSdkConfigApiStatus.Loading)

    // Build the config object with only the fields for this section
    let configToSave: Partial<SdkConfig> = {}

    switch (section) {
      case 'crashes':
        configToSave = {
          crash_take_screenshot: sdkConfig.crash_take_screenshot,
          crash_timeline_sampling_rate: sdkConfig.crash_timeline_sampling_rate
        }
        break
      case 'anrs':
        configToSave = {
          anr_take_screenshot: sdkConfig.anr_take_screenshot,
          anr_timeline_sampling_rate: sdkConfig.anr_timeline_sampling_rate
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

    console.log(`Saving ${section} config:`, configToSave)

    const result = await updateSdkConfigFromServer(appId, configToSave as SdkConfig)

    switch (result.status) {
      case UpdateSdkConfigApiStatus.Error:
        setSaveStatus(UpdateSdkConfigApiStatus.Error)
        toastNegative("Error saving configuration", result.error)
        break
      case UpdateSdkConfigApiStatus.Success:
        setSaveStatus(UpdateSdkConfigApiStatus.Success)
        // Update original config with the saved values
        setOriginalSdkConfig(sdkConfig)
        toastPositive("Configuration saved")
        break
      case UpdateSdkConfigApiStatus.Cancelled:
        setSaveStatus(UpdateSdkConfigApiStatus.Init)
        break
    }
  }

  const saveCrashes = () => saveSdkConfigSection('crashes', setCrashesSaveStatus)
  const saveAnrs = () => saveSdkConfigSection('anrs', setAnrsSaveStatus)
  const saveTraces = () => saveSdkConfigSection('traces', setTracesSaveStatus)
  const saveLaunch = () => saveSdkConfigSection('launch_metrics', setLaunchSaveStatus)
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
      'sensitive_fields_only': 'Sensitive fileds only',
    }
    return map[maskLevel]
  }

  // Convert display format to mask level, must be in sync with maskLevelToDisplay.
  const displayToMaskLevel = (display: string): string => {
    const map: { [key: string]: string } = {
      'All text and media': 'all_text_and_media',
      'All text': 'all_text',
      'All text except clickable': 'all_text_except_clickable',
      'Sensitive fileds only': 'sensitive_fields_only',
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

  const textareaClassName = "w-full border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400 resize-none overflow-auto max-h-40"

  // Helper to check if ANR should be shown
  const shouldShowAnr = osName === null || osName === undefined || osName.toLowerCase() === 'android'

  // Confirmation dialog body generators
  const getCrashesConfirmBody = () => {
    return (
      <div className="font-body">
        <p>Are you sure you want to update crash settings for app <span className="font-display font-bold">{appName}</span>?</p>
        <br />
        <p>The following changes will be applied:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          {sdkConfig.crash_take_screenshot !== originalSdkConfig.crash_take_screenshot && (
            <li>Screenshot collection: <span className="font-display font-bold">{sdkConfig.crash_take_screenshot ? 'Enabled' : 'Disabled'}</span></li>
          )}
          {sdkConfig.crash_timeline_sampling_rate !== originalSdkConfig.crash_timeline_sampling_rate && (
            <li>Timeline sampling rate: <span className="font-display font-bold">{originalSdkConfig.crash_timeline_sampling_rate}%</span> → <span className="font-display font-bold">{sdkConfig.crash_timeline_sampling_rate}%</span></li>
          )}
        </ul>
        <br />
        <p>These changes will apply to all new crashes.</p>
      </div>
    )
  }

  const getAnrsConfirmBody = () => {
    return (
      <div className="font-body">
        <p>Are you sure you want to update ANR settings for app <span className="font-display font-bold">{appName}</span>?</p>
        <br />
        <p>The following changes will be applied:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          {sdkConfig.anr_take_screenshot !== originalSdkConfig.anr_take_screenshot && (
            <li>Screenshot collection: <span className="font-display font-bold">{sdkConfig.anr_take_screenshot ? 'Enabled' : 'Disabled'}</span></li>
          )}
          {sdkConfig.anr_timeline_sampling_rate !== originalSdkConfig.anr_timeline_sampling_rate && (
            <li>Timeline sampling rate: <span className="font-display font-bold">{originalSdkConfig.anr_timeline_sampling_rate}%</span> → <span className="font-display font-bold">{sdkConfig.anr_timeline_sampling_rate}%</span></li>
          )}
        </ul>
        <br />
        <p>These changes will apply to all new ANRs.</p>
      </div>
    )
  }

  const getTracesConfirmBody = () => {
    return (
      <div className="font-body">
        <p>Are you sure you want to update trace settings for app <span className="font-display font-bold">{appName}</span>?</p>
        <br />
        <p>The following changes will be applied:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Sampling rate: <span className="font-display font-bold">{originalSdkConfig.trace_sampling_rate}%</span> → <span className="font-display font-bold">{sdkConfig.trace_sampling_rate}%</span></li>
        </ul>
        <br />
        <p>These changes will apply to all new traces.</p>
      </div>
    )
  }

  const getLaunchConfirmBody = () => {
    return (
      <div className="font-body">
        <p>Are you sure you want to update launch metrics settings for app <span className="font-display font-bold">{appName}</span>?</p>
        <br />
        <p>The following changes will be applied:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Sampling rate: <span className="font-display font-bold">{originalSdkConfig.launch_sampling_rate}%</span> → <span className="font-display font-bold">{sdkConfig.launch_sampling_rate}%</span></li>
        </ul>
        <br />
        <p>These changes will apply to all new launches.</p>
      </div>
    )
  }

  const getHttpConfirmBody = () => {
    return (
      <div className="font-body">
        <p>Are you sure you want to update HTTP collection settings for app <span className="font-display font-bold">{appName}</span>?</p>
        <br />
        <p>The following configurations will be updated:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
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
        <br />
        <p>These changes will apply to all new HTTP requests.</p>
      </div>
    )
  }

  const getMaskingConfirmBody = () => {
    return (
      <div className="font-body">
        <p>Are you sure you want to update screenshot masking settings for app <span className="font-display font-bold">{appName}</span>?</p>
        <br />
        <p>The following changes will be applied:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Mask level: <span className="font-display font-bold">{maskLevelToDisplay(originalSdkConfig.screenshot_mask_level)}</span> → <span className="font-display font-bold">{maskLevelToDisplay(sdkConfig.screenshot_mask_level)}</span></li>
        </ul>
        <br />
        <p>These changes will apply to all new screenshots.</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <p className="font-display text-xl max-w-6xl">Configure data collection</p>

      <div className="mt-6">
        <Accordion type="single" collapsible className="w-full">
          {/* Crashes Accordion */}
          <AccordionItem value="crashes" className="mt-2">
            <AccordionTrigger className="text-base font-body">Crashes</AccordionTrigger>
            <AccordionContent className="bg-gray-50 px-4 py-4">
              <div className="pt-4 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 min-h-[2.5rem]">
                  <p className="text-sm">Collect screenshot with crashes</p>
                  <div className="hidden sm:block sm:w-3"></div>
                  <Switch
                    className="data-[state=checked]:bg-emerald-500"
                    checked={sdkConfig.crash_take_screenshot}
                    onCheckedChange={(checked) => setSdkConfig({ ...sdkConfig, crash_take_screenshot: checked })}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>
                <SamplingRateInput
                  value={sdkConfig.crash_timeline_sampling_rate}
                  maxValue={100}
                  onChange={(value) => setSdkConfig({ ...sdkConfig, crash_timeline_sampling_rate: value })}
                  disabled={!currentUserCanChangeAppSettings}
                />
                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    className="font-display border border-black select-none"
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

          {/* ANRs Accordion - Only show for Android or null */}
          {shouldShowAnr && (
            <AccordionItem value="anrs" className="mt-2">
              <AccordionTrigger className="text-base font-body">ANRs</AccordionTrigger>
              <AccordionContent className="bg-gray-50 px-4 py-4">
                <div className="pt-4 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 min-h-[2.5rem]">
                    <p className="text-sm">Collect screenshot with ANRs</p>
                    <div className="hidden sm:block sm:w-3"></div>
                    <Switch
                      className="data-[state=checked]:bg-emerald-500"
                      checked={sdkConfig.anr_take_screenshot}
                      onCheckedChange={(checked) => setSdkConfig({ ...sdkConfig, anr_take_screenshot: checked })}
                      disabled={!currentUserCanChangeAppSettings}
                    />
                  </div>
                  <SamplingRateInput
                    value={sdkConfig.anr_timeline_sampling_rate}
                    maxValue={100}
                    onChange={(value) => setSdkConfig({ ...sdkConfig, anr_timeline_sampling_rate: value })}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="outline"
                      className="font-display border border-black select-none"
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

          {/* Traces Accordion */}

          <AccordionItem value="traces" className="mt-2">
            <AccordionTrigger className="text-base font-body">Traces</AccordionTrigger>
            <AccordionContent className="bg-gray-50 px-4 py-4">
              <div className="pt-4 pb-2 space-y-4">
                <SamplingRateInput
                  value={sdkConfig.trace_sampling_rate}
                  maxValue={100}
                  onChange={(value) => setSdkConfig({ ...sdkConfig, trace_sampling_rate: value })}
                  disabled={!currentUserCanChangeAppSettings}
                />
                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    className="font-display border border-black select-none"
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
            <AccordionTrigger className="text-base font-body">Launch Metrics</AccordionTrigger>
            <AccordionContent className="bg-gray-50 px-4 py-4">
              <div className="pt-4 space-y-6">
                <SamplingRateInput
                  value={sdkConfig.launch_sampling_rate}
                  maxValue={100}
                  onChange={(value) => setSdkConfig({ ...sdkConfig, launch_sampling_rate: value })}
                  disabled={!currentUserCanChangeAppSettings}
                />
                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    className="font-display border border-black select-none"
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

          {/* HTTP Accordion */}
          <AccordionItem value="http" className="mt-2">
            <AccordionTrigger className="text-base font-body">HTTP</AccordionTrigger>
            <AccordionContent className="bg-gray-50 px-4 py-4">
              <div className="pt-4 space-y-8">
                {/* Disable HTTP event for URLs */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display text-base">Disable HTTP event for URLs</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex items-center">
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
                    rows={4}
                    value={arrayToInput(sdkConfig.http_disable_event_for_urls)}
                    onChange={(e) => setSdkConfig({ ...sdkConfig, http_disable_event_for_urls: inputToArray(e.target.value) })}
                    placeholder={getUrlPlaceholder()}
                    className={textareaClassName}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>

                <div className="py-0.5"></div>

                {/* Track Request for URLs */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display text-base">Track request for URLs</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex items-center">
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
                    rows={4}
                    value={arrayToInput(sdkConfig.http_track_request_for_urls)}
                    onChange={(e) => setSdkConfig({ ...sdkConfig, http_track_request_for_urls: inputToArray(e.target.value) })}
                    placeholder={getUrlPlaceholder()}
                    className={textareaClassName}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>

                <div className="py-0.5"></div>

                {/* Track Response for URLs */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display text-base">Track response for URLs</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex items-center">
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
                    rows={4}
                    value={arrayToInput(sdkConfig.http_track_response_for_urls)}
                    onChange={(e) => setSdkConfig({ ...sdkConfig, http_track_response_for_urls: inputToArray(e.target.value) })}
                    placeholder={getUrlPlaceholder()}
                    className={textareaClassName}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>

                <div className="py-0.5"></div>

                {/* Blocked Headers */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display text-base">Blocked headers</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex items-center">
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
                    rows={4}
                    value={arrayToInput(sdkConfig.http_blocked_headers)}
                    onChange={(e) => setSdkConfig({ ...sdkConfig, http_blocked_headers: inputToArray(e.target.value) })}
                    placeholder={getHeaderPlaceholder()}
                    className={textareaClassName}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>

                <div className="py-0.5"></div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    className="font-display border border-black select-none"
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
            <AccordionTrigger className="text-base font-body">Screenshot Masking</AccordionTrigger>
            <AccordionContent className="bg-gray-50 px-4 py-4">
              <div className="pt-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 min-h-[2.5rem]">
                  <p className="text-sm">Screenshot mask level</p>
                  <div className="hidden sm:block sm:w-3"></div>
                  <DropdownSelect
                    type={DropdownSelectType.SingleString}
                    title=""
                    items={['All text and media', 'All text', 'All text except clickable', 'Sensitive fileds only']}
                    initialSelected={maskLevelToDisplay(sdkConfig.screenshot_mask_level)}
                    onChangeSelected={(item) => setSdkConfig({ ...sdkConfig, screenshot_mask_level: displayToMaskLevel(item as string) })}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    className="font-display border border-black select-none"
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
    </div >
  )
}