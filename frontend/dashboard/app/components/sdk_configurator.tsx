"use client";

import { SdkConfig } from "@/app/api/api_calls";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/app/components/accordion";
import { Button } from "@/app/components/button";
import DropdownSelect, {
  DropdownSelectType,
} from "@/app/components/dropdown_select";
import InfoTooltip from "@/app/components/info_tooltip";
import SdkConfigNumericInput from "@/app/components/sdk_config_numeric_input";
import { Switch } from "@/app/components/switch";
import { useSaveSdkConfigMutation } from "@/app/query/hooks";
import { track } from "@/app/utils/analytics/track";
import { toastNegative, toastPositive } from "@/app/utils/use_toast";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { underlineLinkStyle } from "../utils/shared_styles";
import DangerConfirmationDialog from "./danger_confirmation_dialog";
import { Textarea } from "./textarea";

interface SdkConfiguratorProps {
  appId: string;
  appName: string;
  initialConfig: SdkConfig;
  currentUserCanChangeAppSettings: boolean;
  osName?: string | null;
}

type SectionSaveStatus = "idle" | "saving" | "saved" | "error";

const accordionContentStyle = "p-4";

export default function SdkConfigurator({
  appId,
  appName,
  initialConfig,
  currentUserCanChangeAppSettings,
  osName,
}: SdkConfiguratorProps) {
  // Local editable state
  const [sdkConfig, setSdkConfigState] = useState<SdkConfig | null>(
    initialConfig,
  );
  const [originalSdkConfig, setOriginalSdkConfig] = useState<SdkConfig | null>(
    initialConfig,
  );

  // Per-section save status tracking
  const [sectionStatuses, setSectionStatuses] = useState<
    Record<string, SectionSaveStatus>
  >({
    crashes: "idle",
    anrs: "idle",
    bugReports: "idle",
    traces: "idle",
    launch: "idle",
    journey: "idle",
    http: "idle",
    masking: "idle",
  });

  // TanStack Query mutation
  const saveSdkConfigMutation = useSaveSdkConfigMutation();
  const routeParams = useParams<{ teamId: string }>();

  // Confirmation dialog states
  const [crashesConfirmOpen, setCrashesConfirmOpen] = useState(false);
  const [anrsConfirmOpen, setAnrsConfirmOpen] = useState(false);
  const [bugReportsConfirmOpen, setBugReportsConfirmOpen] = useState(false);
  const [tracesConfirmOpen, setTracesConfirmOpen] = useState(false);
  const [launchConfirmOpen, setLaunchConfirmOpen] = useState(false);
  const [journeyConfirmOpen, setJourneyConfirmOpen] = useState(false);
  const [httpConfirmOpen, setHttpConfirmOpen] = useState(false);
  const [maskingConfirmOpen, setMaskingConfirmOpen] = useState(false);

  // Sync initialConfig prop into local state when it changes.
  const [prevInitialConfig, setPrevInitialConfig] = useState(initialConfig);
  if (initialConfig !== prevInitialConfig) {
    setPrevInitialConfig(initialConfig);
    setSdkConfigState(initialConfig);
    setOriginalSdkConfig(initialConfig);
  }

  const updateSdkConfig = (updates: Partial<SdkConfig>) => {
    if (!sdkConfig) {
      return;
    }
    setSdkConfigState({ ...sdkConfig, ...updates });
  };

  // Track changes per section, derived from the current vs. original config.
  const crashesChanged =
    !!sdkConfig &&
    !!originalSdkConfig &&
    (sdkConfig.crash_take_screenshot !==
      originalSdkConfig.crash_take_screenshot ||
      sdkConfig.crash_timeline_duration !==
        originalSdkConfig.crash_timeline_duration);
  const anrsChanged =
    !!sdkConfig &&
    !!originalSdkConfig &&
    (sdkConfig.anr_take_screenshot !== originalSdkConfig.anr_take_screenshot ||
      sdkConfig.anr_timeline_duration !==
        originalSdkConfig.anr_timeline_duration);
  const bugReportsChanged =
    !!sdkConfig &&
    !!originalSdkConfig &&
    sdkConfig.bug_report_timeline_duration !==
      originalSdkConfig.bug_report_timeline_duration;
  const tracesChanged =
    !!sdkConfig &&
    !!originalSdkConfig &&
    sdkConfig.trace_sampling_rate !== originalSdkConfig.trace_sampling_rate;
  const launchMetricsChanged =
    !!sdkConfig &&
    !!originalSdkConfig &&
    sdkConfig.launch_sampling_rate !== originalSdkConfig.launch_sampling_rate;
  const journeyChanged =
    !!sdkConfig &&
    !!originalSdkConfig &&
    sdkConfig.journey_sampling_rate !== originalSdkConfig.journey_sampling_rate;
  const httpChanged =
    !!sdkConfig &&
    !!originalSdkConfig &&
    (sdkConfig.http_sampling_rate !== originalSdkConfig.http_sampling_rate ||
      JSON.stringify(sdkConfig.http_disable_event_for_urls) !==
        JSON.stringify(originalSdkConfig.http_disable_event_for_urls) ||
      JSON.stringify(sdkConfig.http_track_request_for_urls) !==
        JSON.stringify(originalSdkConfig.http_track_request_for_urls) ||
      JSON.stringify(sdkConfig.http_track_response_for_urls) !==
        JSON.stringify(originalSdkConfig.http_track_response_for_urls) ||
      JSON.stringify(sdkConfig.http_blocked_headers) !==
        JSON.stringify(originalSdkConfig.http_blocked_headers));
  const screenshotMaskingChanged =
    !!sdkConfig &&
    !!originalSdkConfig &&
    sdkConfig.screenshot_mask_level !== originalSdkConfig.screenshot_mask_level;

  if (!sdkConfig || !originalSdkConfig) {
    return null;
  }

  const setSectionStatus = (section: string, status: SectionSaveStatus) => {
    setSectionStatuses((prev) => ({ ...prev, [section]: status }));
  };

  const saveSection = (
    sectionKey: string,
    configToSave: Partial<SdkConfig>,
  ) => {
    setSectionStatus(sectionKey, "saving");
    saveSdkConfigMutation.mutate(
      { appId, config: configToSave },
      {
        onSuccess: () => {
          setSectionStatus(sectionKey, "saved");
          setOriginalSdkConfig((prev) =>
            prev ? { ...prev, ...configToSave } : prev,
          );
          toastPositive("Configuration saved");
          track("sampling_adjusted", {
            team_id: routeParams?.teamId,
            app_id: appId,
            app_platform: osName,
            feature_area: "sampling",
            entry_point: "direct",
            section: sectionKey,
          });
        },
        onError: () => {
          setSectionStatus(sectionKey, "error");
          toastNegative("Error saving configuration");
        },
      },
    );
  };

  const handleSaveCrashes = () => {
    saveSection("crashes", {
      crash_take_screenshot: sdkConfig.crash_take_screenshot,
      crash_timeline_duration: sdkConfig.crash_timeline_duration,
    });
  };
  const handleSaveAnrs = () => {
    saveSection("anrs", {
      anr_take_screenshot: sdkConfig.anr_take_screenshot,
      anr_timeline_duration: sdkConfig.anr_timeline_duration,
    });
  };
  const handleSaveBugReports = () => {
    saveSection("bugReports", {
      bug_report_timeline_duration: sdkConfig.bug_report_timeline_duration,
    });
  };
  const handleSaveTraces = () => {
    saveSection("traces", {
      trace_sampling_rate: sdkConfig.trace_sampling_rate,
    });
  };
  const handleSaveLaunch = () => {
    saveSection("launch", {
      launch_sampling_rate: sdkConfig.launch_sampling_rate,
    });
  };
  const handleSaveJourney = () => {
    saveSection("journey", {
      journey_sampling_rate: sdkConfig.journey_sampling_rate,
    });
  };
  const handleSaveHttp = () => {
    saveSection("http", {
      http_sampling_rate: sdkConfig.http_sampling_rate,
      http_disable_event_for_urls: sdkConfig.http_disable_event_for_urls.filter(
        (url) => url.trim() !== "",
      ),
      http_track_request_for_urls: sdkConfig.http_track_request_for_urls.filter(
        (url) => url.trim() !== "",
      ),
      http_track_response_for_urls:
        sdkConfig.http_track_response_for_urls.filter(
          (url) => url.trim() !== "",
        ),
      http_blocked_headers: sdkConfig.http_blocked_headers.filter(
        (header) => header.trim() !== "",
      ),
    });
  };
  const handleSaveMasking = () => {
    saveSection("masking", {
      screenshot_mask_level: sdkConfig.screenshot_mask_level,
    });
  };

  const arrayToInput = (arr: string[]): string => {
    if (!arr || arr.length === 0) return "";
    return arr.join("\n");
  };

  const inputToArray = (str: string): string[] => {
    if (!str || str.trim() === "") return [];
    return str.split("\n").map((line) => line.trim());
  };

  // Convert mask level to display format, must be in sync with displayToMaskLevel.
  const maskLevelToDisplay = (maskLevel: string): string => {
    const map: { [key: string]: string } = {
      all_text_and_media: "All text and media",
      all_text: "All text",
      all_text_except_clickable: "All text except clickable",
      sensitive_fields_only: "Sensitive fields only",
    };
    return map[maskLevel];
  };

  // Convert display format to mask level, must be in sync with maskLevelToDisplay.
  const displayToMaskLevel = (display: string): string => {
    const map: { [key: string]: string } = {
      "All text and media": "all_text_and_media",
      "All text": "all_text",
      "All text except clickable": "all_text_except_clickable",
      "Sensitive fields only": "sensitive_fields_only",
    };
    return map[display] || "sensitive_fields_only";
  };

  const getUrlPlaceholder = () =>
    [
      "https://api.example.com/v1/public/*",
      "https://example.com/*/health",
    ].join("\n");

  const getHeaderPlaceholder = () => ["X-User-ID", "X-API-Key"].join("\n");

  // Helper to check if ANR should be shown
  const shouldShowAnr =
    osName === null ||
    osName === undefined ||
    osName.toLowerCase() === "android";

  // Confirmation dialog body generators
  const getCrashesConfirmBody = () => {
    return (
      <div className="font-body">
        <p>
          Are you sure you want to update{" "}
          <span className="font-display font-bold">Crash settings</span> for app{" "}
          <span className="font-display font-bold">{appName}</span>?
        </p>
        <p className="mt-4">The following changes will be applied:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          {sdkConfig.crash_take_screenshot !==
            originalSdkConfig.crash_take_screenshot && (
            <li>
              Screenshot with crash{" "}
              <span className="font-display font-bold">
                {sdkConfig.crash_take_screenshot ? "Enabled" : "Disabled"}
              </span>
            </li>
          )}
          {sdkConfig.crash_timeline_duration !==
            originalSdkConfig.crash_timeline_duration && (
            <li>
              Session Timeline duration:{" "}
              <span className="font-display font-bold">
                {originalSdkConfig.crash_timeline_duration} seconds
              </span>{" "}
              →{" "}
              <span className="font-display font-bold">
                {sdkConfig.crash_timeline_duration} seconds
              </span>
            </li>
          )}
        </ul>
        <p className="mt-4">These changes will apply to all new crashes.</p>
      </div>
    );
  };

  const getAnrsConfirmBody = () => {
    return (
      <div className="font-body">
        <p>
          Are you sure you want to update{" "}
          <span className="font-display font-bold">ANR settings</span> for app{" "}
          <span className="font-display font-bold">{appName}</span>?
        </p>
        <p className="mt-4">The following changes will be applied:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          {sdkConfig.anr_take_screenshot !==
            originalSdkConfig.anr_take_screenshot && (
            <li>
              Screenshot with ANR:{" "}
              <span className="font-display font-bold">
                {sdkConfig.anr_take_screenshot ? "Enabled" : "Disabled"}
              </span>
            </li>
          )}
          {sdkConfig.anr_timeline_duration !==
            originalSdkConfig.anr_timeline_duration && (
            <li>
              Session timeline duration:{" "}
              <span className="font-display font-bold">
                {originalSdkConfig.anr_timeline_duration} seconds
              </span>{" "}
              →{" "}
              <span className="font-display font-bold">
                {sdkConfig.anr_timeline_duration} seconds
              </span>
            </li>
          )}
        </ul>
        <p className="mt-4">These changes will apply to all new ANRs.</p>
      </div>
    );
  };

  const getBugReportsConfirmBody = () => {
    return (
      <div className="font-body">
        <p>
          Are you sure you want to update{" "}
          <span className="font-display font-bold">Bug Report settings</span>{" "}
          for app <span className="font-display font-bold">{appName}</span>?
        </p>
        <p className="mt-4">The following changes will be applied:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>
            Session timeline duration:{" "}
            <span className="font-display font-bold">
              {originalSdkConfig.bug_report_timeline_duration} seconds
            </span>{" "}
            →{" "}
            <span className="font-display font-bold">
              {sdkConfig.bug_report_timeline_duration} seconds
            </span>
          </li>
        </ul>
        <p className="mt-4">These changes will apply to all new bug reports.</p>
      </div>
    );
  };

  const getTracesConfirmBody = () => {
    return (
      <div className="font-body">
        <p>
          Are you sure you want to update{" "}
          <span className="font-display font-bold">Trace settings</span> for app{" "}
          <span className="font-display font-bold">{appName}</span>?
        </p>
        <p className="mt-4">The following changes will be applied:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>
            Sampling rate:{" "}
            <span className="font-display font-bold">
              {originalSdkConfig.trace_sampling_rate}%
            </span>{" "}
            →{" "}
            <span className="font-display font-bold">
              {sdkConfig.trace_sampling_rate}%
            </span>
          </li>
        </ul>
        <p className="mt-4">These changes will apply to all new traces.</p>
      </div>
    );
  };

  const getLaunchConfirmBody = () => {
    return (
      <div className="font-body">
        <p>
          Are you sure you want to update{" "}
          <span className="font-display font-bold">
            Launch Metrics settings
          </span>{" "}
          for app <span className="font-display font-bold">{appName}</span>?
        </p>
        <p className="mt-4">The following changes will be applied:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>
            Sampling rate:{" "}
            <span className="font-display font-bold">
              {originalSdkConfig.launch_sampling_rate}%
            </span>{" "}
            →{" "}
            <span className="font-display font-bold">
              {sdkConfig.launch_sampling_rate}%
            </span>
          </li>
        </ul>
        <p className="mt-4">These changes will apply to all new launches.</p>
      </div>
    );
  };

  const getJourneysConfirmBody = () => {
    return (
      <div className="font-body">
        <p>
          Are you sure you want to update{" "}
          <span className="font-display font-bold">User Journey settings</span>{" "}
          for app <span className="font-display font-bold">{appName}</span>?
        </p>
        <p className="mt-4">The following changes will be applied:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>
            Sampling rate:{" "}
            <span className="font-display font-bold">
              {originalSdkConfig.journey_sampling_rate}%
            </span>{" "}
            →{" "}
            <span className="font-display font-bold">
              {sdkConfig.journey_sampling_rate}%
            </span>
          </li>
        </ul>
        <p className="mt-4">These changes will apply to all new sessions.</p>
      </div>
    );
  };

  const getHttpConfirmBody = () => {
    return (
      <div className="font-body">
        <p>
          Are you sure you want to update{" "}
          <span className="font-display font-bold">
            HTTP collection settings
          </span>{" "}
          for app <span className="font-display font-bold">{appName}</span>?
        </p>
        <p className="mt-4">The following configurations will be updated:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          {sdkConfig.http_sampling_rate !==
            originalSdkConfig.http_sampling_rate && (
            <li>
              Sampling rate:{" "}
              <span className="font-display font-bold">
                {originalSdkConfig.http_sampling_rate} %
              </span>{" "}
              →{" "}
              <span className="font-display font-bold">
                {sdkConfig.http_sampling_rate} %
              </span>
            </li>
          )}
          {JSON.stringify(sdkConfig.http_disable_event_for_urls) !==
            JSON.stringify(originalSdkConfig.http_disable_event_for_urls) && (
            <li>Disabled HTTP events for URLs</li>
          )}
          {JSON.stringify(sdkConfig.http_track_request_for_urls) !==
            JSON.stringify(originalSdkConfig.http_track_request_for_urls) && (
            <li>Collect request for URLs</li>
          )}
          {JSON.stringify(sdkConfig.http_track_response_for_urls) !==
            JSON.stringify(originalSdkConfig.http_track_response_for_urls) && (
            <li>Collect response for URLs</li>
          )}
          {JSON.stringify(sdkConfig.http_blocked_headers) !==
            JSON.stringify(originalSdkConfig.http_blocked_headers) && (
            <li>Blocked headers</li>
          )}
        </ul>
        <p className="mt-4">
          These changes will apply to all new HTTP requests.
        </p>
      </div>
    );
  };

  const getMaskingConfirmBody = () => {
    return (
      <div className="font-body">
        <p>
          Are you sure you want to update{" "}
          <span className="font-display font-bold">
            Screenshot Masking settings
          </span>{" "}
          for app <span className="font-display font-bold">{appName}</span>?
        </p>
        <p className="mt-4">The following changes will be applied:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>
            Mask level:{" "}
            <span className="font-display font-bold">
              {maskLevelToDisplay(originalSdkConfig.screenshot_mask_level)}
            </span>{" "}
            →{" "}
            <span className="font-display font-bold">
              {maskLevelToDisplay(sdkConfig.screenshot_mask_level)}
            </span>
          </li>
        </ul>
        <p className="mt-4">These changes will apply to all new screenshots.</p>
      </div>
    );
  };

  const preventSpaceKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === " ") {
      e.preventDefault();
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <p className="max-w-6xl font-display text-xl">
          Configure Data Collection
        </p>
        <InfoTooltip
          content={
            <>
              See the{" "}
              <Link
                href="/docs/features/configuration-options"
                className={underlineLinkStyle}
              >
                docs
              </Link>{" "}
              to learn more
            </>
          }
        />
      </div>

      <div className="mt-6">
        <Accordion type="single" collapsible className="w-full">
          {/* Crashes Accordion */}
          <AccordionItem value="crashes" className="mt-2">
            <AccordionTrigger className="font-body text-base">
              Crashes
            </AccordionTrigger>
            <AccordionContent className={accordionContentStyle}>
              <div className="mt-2 space-y-4">
                <div className="flex flex-col gap-2 min-h-[2.5rem] sm:flex-row sm:items-center sm:gap-0">
                  <p className="text-sm">Collect screenshot with crashes</p>
                  <Switch
                    data-testid="crash-screenshot-switch"
                    className="sm:ml-4"
                    checked={sdkConfig.crash_take_screenshot}
                    onCheckedChange={(checked) =>
                      updateSdkConfig({ crash_take_screenshot: checked })
                    }
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm">
                    Collect session timeline of
                  </span>
                  <SdkConfigNumericInput
                    testId="crash-timeline-duration-input"
                    value={sdkConfig.crash_timeline_duration}
                    minValue={0}
                    maxValue={3600}
                    onChange={(val) =>
                      updateSdkConfig({ crash_timeline_duration: val })
                    }
                    disabled={!currentUserCanChangeAppSettings}
                  />
                  <span className="font-body text-sm">
                    seconds with every crash
                  </span>
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    data-testid="crashes-save-button"
                    variant="outline"
                    disabled={
                      !currentUserCanChangeAppSettings || !crashesChanged
                    }
                    loading={sectionStatuses.crashes === "saving"}
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
              <AccordionTrigger className="font-body text-base">
                ANRs
              </AccordionTrigger>
              <AccordionContent className={accordionContentStyle}>
                <div className="mt-2 space-y-4">
                  <div className="flex flex-col gap-2 min-h-[2.5rem] sm:flex-row sm:items-center sm:gap-0">
                    <p className="text-sm">Collect screenshot with ANRs</p>
                    <Switch
                      data-testid="anr-screenshot-switch"
                      className="sm:ml-4"
                      checked={sdkConfig.anr_take_screenshot}
                      onCheckedChange={(checked) =>
                        updateSdkConfig({ anr_take_screenshot: checked })
                      }
                      disabled={!currentUserCanChangeAppSettings}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-body text-sm">
                      Collect session timeline of
                    </span>
                    <SdkConfigNumericInput
                      testId="anr-timeline-duration-input"
                      value={sdkConfig.anr_timeline_duration}
                      minValue={0}
                      maxValue={3600}
                      onChange={(val) =>
                        updateSdkConfig({ anr_timeline_duration: val })
                      }
                      disabled={!currentUserCanChangeAppSettings}
                    />
                    <span className="font-body text-sm">
                      seconds with every ANR
                    </span>
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button
                      data-testid="anrs-save-button"
                      variant="outline"
                      disabled={
                        !currentUserCanChangeAppSettings || !anrsChanged
                      }
                      loading={sectionStatuses.anrs === "saving"}
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
            <AccordionTrigger className="font-body text-base">
              Bug Reports
            </AccordionTrigger>
            <AccordionContent className={accordionContentStyle}>
              <div className="mt-2 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm">
                    Collect session timeline of
                  </span>
                  <SdkConfigNumericInput
                    testId="bug-report-timeline-duration-input"
                    value={sdkConfig.bug_report_timeline_duration}
                    minValue={0}
                    maxValue={3600}
                    onChange={(val) =>
                      updateSdkConfig({ bug_report_timeline_duration: val })
                    }
                    disabled={!currentUserCanChangeAppSettings}
                  />
                  <span className="font-body text-sm">
                    seconds with every Bug Report
                  </span>
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    data-testid="bug-reports-save-button"
                    variant="outline"
                    disabled={
                      !currentUserCanChangeAppSettings || !bugReportsChanged
                    }
                    loading={sectionStatuses.bugReports === "saving"}
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
            <AccordionTrigger className="font-body text-base">
              Traces
            </AccordionTrigger>
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
                    onChange={(value) =>
                      updateSdkConfig({ trace_sampling_rate: value })
                    }
                    disabled={!currentUserCanChangeAppSettings}
                  />
                  <span className="font-body text-sm">% sampling rate</span>
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    data-testid="traces-save-button"
                    variant="outline"
                    disabled={
                      !currentUserCanChangeAppSettings || !tracesChanged
                    }
                    loading={sectionStatuses.traces === "saving"}
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
            <AccordionTrigger className="font-body text-base">
              Launch Metrics
            </AccordionTrigger>
            <AccordionContent className={accordionContentStyle}>
              <div className="mt-2 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm">
                    Collect cold, warm and hot launch metrics at
                  </span>
                  <SdkConfigNumericInput
                    testId="launch-sampling-rate-input"
                    value={sdkConfig.launch_sampling_rate}
                    minValue={0}
                    maxValue={100}
                    step={0.01}
                    type="float"
                    onChange={(value) =>
                      updateSdkConfig({ launch_sampling_rate: value })
                    }
                    disabled={!currentUserCanChangeAppSettings}
                  />
                  <span className="font-body text-sm">% sampling rate</span>
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    data-testid="launch-save-button"
                    variant="outline"
                    disabled={
                      !currentUserCanChangeAppSettings || !launchMetricsChanged
                    }
                    loading={sectionStatuses.launch === "saving"}
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
            <AccordionTrigger className="font-body text-base">
              User Journeys
            </AccordionTrigger>
            <AccordionContent className={accordionContentStyle}>
              <div className="mt-2 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm">
                    Collect user journeys for
                  </span>
                  <SdkConfigNumericInput
                    testId="journey-sampling-rate-input"
                    value={sdkConfig.journey_sampling_rate}
                    minValue={0}
                    maxValue={100}
                    step={0.01}
                    type="float"
                    onChange={(value) =>
                      updateSdkConfig({ journey_sampling_rate: value })
                    }
                    disabled={!currentUserCanChangeAppSettings}
                  />
                  <span className="font-body text-sm">% sessions</span>
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    data-testid="journey-save-button"
                    variant="outline"
                    disabled={
                      !currentUserCanChangeAppSettings || !journeyChanged
                    }
                    loading={sectionStatuses.journey === "saving"}
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
            <AccordionTrigger className="font-body text-base">
              HTTP
            </AccordionTrigger>
            <AccordionContent className={accordionContentStyle}>
              <div className="mt-2 space-y-4">
                {/* HTTP events sampling rate */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm">
                    Collect HTTP events at
                  </span>
                  <SdkConfigNumericInput
                    testId="http-sampling-rate-input"
                    value={sdkConfig.http_sampling_rate}
                    minValue={0}
                    maxValue={100}
                    step={0.01}
                    type="float"
                    onChange={(value) =>
                      updateSdkConfig({ http_sampling_rate: value })
                    }
                    disabled={!currentUserCanChangeAppSettings}
                  />
                  <span className="font-body text-sm">% sampling rate</span>
                </div>
                {/* Disable HTTP event for URLs */}
                <div className="py-8">
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display">Disable HTTP event for URLs</p>
                    <InfoTooltip
                      content={
                        <>
                          HTTP events will not be collected for URLs matching
                          these patterns. Supports exact match and wildcards
                          (*). Enter one pattern per line.
                        </>
                      }
                    />
                  </div>
                  <Textarea
                    data-testid="http-disable-urls-textarea"
                    rows={4}
                    value={arrayToInput(sdkConfig.http_disable_event_for_urls)}
                    onChange={(e) =>
                      updateSdkConfig({
                        http_disable_event_for_urls: inputToArray(
                          e.target.value,
                        ),
                      })
                    }
                    onKeyDown={preventSpaceKey}
                    placeholder={getUrlPlaceholder()}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>

                {/* Track Request for URLs */}
                <div className="py-2">
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display">Track request for URLs</p>
                    <InfoTooltip
                      content={
                        <>
                          Full HTTP request (body and headers) will be captured
                          for URLs matching these patterns. Supports exact match
                          and wildcards (*). Enter one pattern per line.
                        </>
                      }
                    />
                  </div>
                  <Textarea
                    data-testid="http-track-request-urls-textarea"
                    rows={4}
                    value={arrayToInput(sdkConfig.http_track_request_for_urls)}
                    onChange={(e) =>
                      updateSdkConfig({
                        http_track_request_for_urls: inputToArray(
                          e.target.value,
                        ),
                      })
                    }
                    onKeyDown={preventSpaceKey}
                    placeholder={getUrlPlaceholder()}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>

                {/* Track Response for URLs */}
                <div className="py-2">
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display">Track response for URLs</p>
                    <InfoTooltip
                      content={
                        <>
                          Full HTTP response (body and headers) will be captured
                          for URLs matching these patterns. Supports exact match
                          and wildcards (*). Enter one pattern per line.
                        </>
                      }
                    />
                  </div>
                  <Textarea
                    data-testid="http-track-response-urls-textarea"
                    rows={4}
                    value={arrayToInput(sdkConfig.http_track_response_for_urls)}
                    onChange={(e) =>
                      updateSdkConfig({
                        http_track_response_for_urls: inputToArray(
                          e.target.value,
                        ),
                      })
                    }
                    onKeyDown={preventSpaceKey}
                    placeholder={getUrlPlaceholder()}
                    disabled={!currentUserCanChangeAppSettings}
                  />
                </div>

                {/* Blocked Headers */}
                <div className="py-2">
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-display">Blocked headers</p>
                    <InfoTooltip
                      content={
                        <>
                          Headers that will never be captured in HTTP requests
                          or responses. Note that common sensitive headers like
                          Authorization, Cookies, etc are never collected by
                          default. Enter one header name per line.
                        </>
                      }
                    />
                  </div>
                  <Textarea
                    data-testid="http-blocked-headers-textarea"
                    rows={4}
                    value={arrayToInput(sdkConfig.http_blocked_headers)}
                    onChange={(e) =>
                      updateSdkConfig({
                        http_blocked_headers: inputToArray(e.target.value),
                      })
                    }
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
                    loading={sectionStatuses.http === "saving"}
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
            <AccordionTrigger className="font-body text-base">
              Screenshot Masking
            </AccordionTrigger>
            <AccordionContent className={accordionContentStyle}>
              <div className="mt-2 space-y-4">
                <div className="flex flex-col gap-2 min-h-[2.5rem] sm:flex-row sm:items-center sm:gap-0">
                  <p className="text-sm">Screenshot mask level</p>
                  <div className="sm:ml-3">
                    <DropdownSelect
                      data-testid="screenshot-mask-level-dropdown"
                      type={DropdownSelectType.SingleString}
                      title=""
                      items={[
                        "All text and media",
                        "All text",
                        "All text except clickable",
                        "Sensitive fields only",
                      ]}
                      initialSelected={maskLevelToDisplay(
                        sdkConfig.screenshot_mask_level,
                      )}
                      onChangeSelected={(item) =>
                        updateSdkConfig({
                          screenshot_mask_level: displayToMaskLevel(
                            item as string,
                          ),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    data-testid="masking-save-button"
                    variant="outline"
                    disabled={
                      !currentUserCanChangeAppSettings ||
                      !screenshotMaskingChanged
                    }
                    loading={sectionStatuses.masking === "saving"}
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
          setCrashesConfirmOpen(false);
          handleSaveCrashes();
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
            setAnrsConfirmOpen(false);
            handleSaveAnrs();
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
          setBugReportsConfirmOpen(false);
          handleSaveBugReports();
        }}
        onCancelAction={() => setBugReportsConfirmOpen(false)}
      />

      <DangerConfirmationDialog
        body={getTracesConfirmBody()}
        open={tracesConfirmOpen}
        affirmativeText="Yes, I'm sure"
        cancelText="Cancel"
        onAffirmativeAction={() => {
          setTracesConfirmOpen(false);
          handleSaveTraces();
        }}
        onCancelAction={() => setTracesConfirmOpen(false)}
      />

      <DangerConfirmationDialog
        body={getLaunchConfirmBody()}
        open={launchConfirmOpen}
        affirmativeText="Yes, I'm sure"
        cancelText="Cancel"
        onAffirmativeAction={() => {
          setLaunchConfirmOpen(false);
          handleSaveLaunch();
        }}
        onCancelAction={() => setLaunchConfirmOpen(false)}
      />

      <DangerConfirmationDialog
        body={getJourneysConfirmBody()}
        open={journeyConfirmOpen}
        affirmativeText="Yes, I'm sure"
        cancelText="Cancel"
        onAffirmativeAction={() => {
          setJourneyConfirmOpen(false);
          handleSaveJourney();
        }}
        onCancelAction={() => setJourneyConfirmOpen(false)}
      />

      <DangerConfirmationDialog
        body={getHttpConfirmBody()}
        open={httpConfirmOpen}
        affirmativeText="Yes, I'm sure"
        cancelText="Cancel"
        onAffirmativeAction={() => {
          setHttpConfirmOpen(false);
          handleSaveHttp();
        }}
        onCancelAction={() => setHttpConfirmOpen(false)}
      />

      <DangerConfirmationDialog
        body={getMaskingConfirmBody()}
        open={maskingConfirmOpen}
        affirmativeText="Yes, I'm sure"
        cancelText="Cancel"
        onAffirmativeAction={() => {
          setMaskingConfirmOpen(false);
          handleSaveMasking();
        }}
        onCancelAction={() => setMaskingConfirmOpen(false)}
      />
    </div>
  );
}
