import { SdkConfig } from "@/app/api/api_calls";

const maskLevelLabels: Record<string, string> = {
  all_text_and_media: "All text and media",
  all_text: "All text",
  all_text_except_clickable: "All text except clickable",
  sensitive_fields_only: "Sensitive fields only",
};

const logSeverityLabels: Record<number, string> = {
  8: "Debug",
  12: "Info",
  16: "Warning",
  20: "Error",
  24: "Fatal",
};

export const maskLevelToDisplay = (maskLevel: string): string =>
  maskLevelLabels[maskLevel];

export const displayToMaskLevel = (display: string): string =>
  Object.keys(maskLevelLabels).find(
    (maskLevel) => maskLevelLabels[maskLevel] === display,
  ) ?? "sensitive_fields_only";

export const logSeverityNumberToDisplay = (severityNumber: number): string =>
  logSeverityLabels[severityNumber] ?? "Info";

export const displayToLogSeverityNumber = (display: string): number =>
  Number(
    Object.keys(logSeverityLabels).find(
      (severityNumber) => logSeverityLabels[Number(severityNumber)] === display,
    ) ?? 12,
  );

type SdkConfigFieldLabel = {
  label: string;
  unit?: string;
  valueLabels?: Record<string, string>;
};

const percent = "%";
const seconds = " seconds";

export const sdkConfigFieldLabels: Record<
  keyof SdkConfig,
  SdkConfigFieldLabel
> = {
  error_fatal_sampling_rate: {
    label: "Sampling rate for fatal errors",
    unit: percent,
  },
  error_unhandled_sampling_rate: {
    label: "Sampling rate for unhandled errors",
    unit: percent,
  },
  error_handled_sampling_rate: {
    label: "Sampling rate for handled errors",
    unit: percent,
  },
  error_fatal_take_screenshot: { label: "Screenshot with fatal errors" },
  error_fatal_replay_enabled: { label: "Session replay with fatal errors" },
  error_unhandled_replay_enabled: {
    label: "Session replay with unhandled errors",
  },
  error_handled_replay_enabled: { label: "Session replay with handled errors" },
  error_replay_duration: {
    label: "Error session replay duration",
    unit: seconds,
  },
  anr_take_screenshot: { label: "Screenshot with ANRs" },
  anr_timeline_duration: {
    label: "ANR session replay duration",
    unit: seconds,
  },
  bug_report_timeline_duration: {
    label: "Bug report session replay duration",
    unit: seconds,
  },
  trace_sampling_rate: { label: "Trace sampling rate", unit: percent },
  launch_sampling_rate: {
    label: "Launch metrics sampling rate",
    unit: percent,
  },
  profile_sampling_rate: { label: "Profiling sampling rate", unit: percent },
  journey_sampling_rate: { label: "User journey sampling rate", unit: percent },
  http_sampling_rate: { label: "HTTP sampling rate", unit: percent },
  http_disable_event_for_urls: { label: "Disabled HTTP events for URLs" },
  http_track_request_for_urls: { label: "Collect HTTP request for URLs" },
  http_track_response_for_urls: { label: "Collect HTTP response for URLs" },
  http_blocked_headers: { label: "Blocked HTTP headers" },
  screenshot_mask_level: {
    label: "Screenshot mask level",
    valueLabels: maskLevelLabels,
  },
  memory_usage_interval: { label: "Memory collection interval", unit: seconds },
  memory_usage_background_interval: {
    label: "Memory background collection interval",
    unit: seconds,
  },
  memory_usage_session_sampling_rate: {
    label: "Memory session sampling rate",
    unit: percent,
  },
  log_autocollect_enabled: { label: "Automatic log collection" },
  log_min_severity: {
    label: "Minimum log level",
    valueLabels: logSeverityLabels,
  },
  log_ignore_patterns: { label: "Log ignore patterns" },
};
