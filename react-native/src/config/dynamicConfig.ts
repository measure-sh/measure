import { internalConsole } from '../utils/internalConsole';
import { ScreenshotMaskLevel } from './screenshotMaskLevel';

export interface IDynamicConfig {
  /** Maximum number of events and spans in a batch. Defaults to 10000. */
  maxEventsInBatch: number;

  /** Duration of session timeline collected with an ANR, in seconds. Defaults to 300. */
  anrTimelineDurationSeconds: number;

  /** Duration of session timeline collected with a bug report, in seconds. Defaults to 300. */
  bugReportTimelineDurationSeconds: number;

  /** Sampling rate for traces. Defaults to 100 */
  traceSamplingRate: number;

  /** Sampling rate for sessions that should track journey events. Defaults to 100 */
  journeySamplingRate: number;

  /** Screenshot masking level */
  screenshotMaskLevel: ScreenshotMaskLevel;

  /** Whether the SDK automatically collects logs from the platform's logging APIs. Manually tracked logs are always collected. Defaults to false. */
  logAutocollectEnabled: boolean;

  /** Minimum severity number of logs to collect. Logs below this number are dropped. Defaults to 16 (warning). */
  logMinSeverity: number;

  /** Regex patterns matched against the log body. A log whose body matches any of the patterns is dropped. Defaults to empty list. */
  logIgnorePatterns: string[];

  /** Interval in seconds to collect CPU usage. Defaults to 5. */
  cpuUsageInterval: number;

  /** Interval in seconds to collect memory usage. Defaults to 5. */
  memoryUsageInterval: number;

  /** Whether to take a screenshot on ANR. Defaults to true. */
  anrTakeScreenshot: boolean;

  /** Sampling rate for launch metrics. Defaults to 100 */
  launchSamplingRate: number;

  /** Whether to take a layout snapshot on gesture click. Defaults to true. */
  gestureClickTakeSnapshot: boolean;

  /** URLs for which HTTP events should be disabled. */
  httpDisableEventForUrls: string[];

  /** URLs for which HTTP requests should be tracked. */
  httpTrackRequestForUrls: string[];

  /** URLs for which HTTP responses should be tracked. */
  httpTrackResponseForUrls: string[];

  /** HTTP headers that should never be collected. */
  httpBlockedHeaders: string[];
}

export class DynamicConfig implements IDynamicConfig {
  maxEventsInBatch: number;
  anrTimelineDurationSeconds: number;
  bugReportTimelineDurationSeconds: number;
  traceSamplingRate: number;
  journeySamplingRate: number;
  screenshotMaskLevel: ScreenshotMaskLevel;
  logAutocollectEnabled: boolean;
  logMinSeverity: number;
  logIgnorePatterns: string[];
  cpuUsageInterval: number;
  memoryUsageInterval: number;
  anrTakeScreenshot: boolean;
  launchSamplingRate: number;
  gestureClickTakeSnapshot: boolean;
  httpDisableEventForUrls: string[];
  httpTrackRequestForUrls: string[];
  httpTrackResponseForUrls: string[];
  httpBlockedHeaders: string[];

  constructor(values: IDynamicConfig) {
    this.maxEventsInBatch = values.maxEventsInBatch;
    this.anrTimelineDurationSeconds = values.anrTimelineDurationSeconds;
    this.bugReportTimelineDurationSeconds =
      values.bugReportTimelineDurationSeconds;
    this.traceSamplingRate = values.traceSamplingRate;
    this.journeySamplingRate = values.journeySamplingRate;
    this.screenshotMaskLevel = values.screenshotMaskLevel;
    this.logAutocollectEnabled = values.logAutocollectEnabled;
    this.logMinSeverity = values.logMinSeverity;
    this.logIgnorePatterns = values.logIgnorePatterns;
    this.cpuUsageInterval = values.cpuUsageInterval;
    this.memoryUsageInterval = values.memoryUsageInterval;
    this.anrTakeScreenshot = values.anrTakeScreenshot;
    this.launchSamplingRate = values.launchSamplingRate;
    this.gestureClickTakeSnapshot = values.gestureClickTakeSnapshot;
    this.httpDisableEventForUrls = values.httpDisableEventForUrls;
    this.httpTrackRequestForUrls = values.httpTrackRequestForUrls;
    this.httpTrackResponseForUrls = values.httpTrackResponseForUrls;
    this.httpBlockedHeaders = values.httpBlockedHeaders;
  }

  static default(): DynamicConfig {
    return new DynamicConfig({
      maxEventsInBatch: 10_000,
      anrTimelineDurationSeconds: 300,
      bugReportTimelineDurationSeconds: 300,
      traceSamplingRate: 100,
      journeySamplingRate: 100,
      screenshotMaskLevel: ScreenshotMaskLevel.allTextAndMedia,
      logAutocollectEnabled: false,
      logMinSeverity: 16,
      logIgnorePatterns: [],
      cpuUsageInterval: 5,
      memoryUsageInterval: 5,
      anrTakeScreenshot: true,
      launchSamplingRate: 100,
      gestureClickTakeSnapshot: true,
      httpDisableEventForUrls: [],
      httpTrackRequestForUrls: [],
      httpTrackResponseForUrls: [],
      httpBlockedHeaders: [
        'Authorization',
        'Cookie',
        'Set-Cookie',
        'Proxy-Authorization',
        'WWW-Authenticate',
        'X-Api-Key',
      ],
    });
  }

  /**
   * Creates DynamicConfig from native object (snake_case keys)
   */
  static fromNative(obj: any): DynamicConfig {
    if (!obj || typeof obj !== 'object') {
      return DynamicConfig.default();
    }

    const defaults = DynamicConfig.default();

    return new DynamicConfig({
      maxEventsInBatch: numberOrDefault(
        obj,
        'max_events_in_batch',
        defaults.maxEventsInBatch
      ),
      anrTimelineDurationSeconds: numberOrDefault(
        obj,
        'anr_timeline_duration',
        defaults.anrTimelineDurationSeconds
      ),
      bugReportTimelineDurationSeconds: numberOrDefault(
        obj,
        'bug_report_timeline_duration',
        defaults.bugReportTimelineDurationSeconds
      ),
      traceSamplingRate: numberOrDefault(
        obj,
        'trace_sampling_rate',
        defaults.traceSamplingRate
      ),
      journeySamplingRate: numberOrDefault(
        obj,
        'journey_sampling_rate',
        defaults.journeySamplingRate
      ),
      screenshotMaskLevel: screenshotMaskLevelOrDefault(
        obj,
        'screenshot_mask_level',
        defaults.screenshotMaskLevel
      ),
      logAutocollectEnabled: booleanOrDefault(
        obj,
        'log_autocollect_enabled',
        defaults.logAutocollectEnabled
      ),
      logMinSeverity: numberOrDefault(
        obj,
        'log_min_severity',
        defaults.logMinSeverity
      ),
      logIgnorePatterns: stringArrayOrDefault(
        obj,
        'log_ignore_patterns',
        defaults.logIgnorePatterns
      ),
      cpuUsageInterval: numberOrDefault(
        obj,
        'cpu_usage_interval',
        defaults.cpuUsageInterval
      ),
      memoryUsageInterval: numberOrDefault(
        obj,
        'memory_usage_interval',
        defaults.memoryUsageInterval
      ),
      anrTakeScreenshot: booleanOrDefault(
        obj,
        'anr_take_screenshot',
        defaults.anrTakeScreenshot
      ),
      launchSamplingRate: numberOrDefault(
        obj,
        'launch_sampling_rate',
        defaults.launchSamplingRate
      ),
      gestureClickTakeSnapshot: booleanOrDefault(
        obj,
        'gesture_click_take_snapshot',
        defaults.gestureClickTakeSnapshot
      ),
      httpDisableEventForUrls: stringArrayOrDefault(
        obj,
        'http_disable_event_for_urls',
        defaults.httpDisableEventForUrls
      ),
      httpTrackRequestForUrls: stringArrayOrDefault(
        obj,
        'http_track_request_for_urls',
        defaults.httpTrackRequestForUrls
      ),
      httpTrackResponseForUrls: stringArrayOrDefault(
        obj,
        'http_track_response_for_urls',
        defaults.httpTrackResponseForUrls
      ),
      httpBlockedHeaders: stringArrayOrDefault(
        obj,
        'http_blocked_headers',
        defaults.httpBlockedHeaders
      ),
    });
  }
}

function warnInvalidField(key: string, expected: string): void {
  internalConsole.warn(
    `[Measure] Dynamic config field '${key}' expected ${expected}, using default.`
  );
}

function numberOrDefault(obj: any, key: string, fallback: number): number {
  const value = obj[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    warnInvalidField(key, 'a number');
    return fallback;
  }
  return value;
}

function booleanOrDefault(obj: any, key: string, fallback: boolean): boolean {
  const value = obj[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    warnInvalidField(key, 'a boolean');
    return fallback;
  }
  return value;
}

function stringArrayOrDefault(
  obj: any,
  key: string,
  fallback: string[]
): string[] {
  const value = obj[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === 'string')
  ) {
    warnInvalidField(key, 'a string array');
    return fallback;
  }
  return value;
}

function screenshotMaskLevelOrDefault(
  obj: any,
  key: string,
  fallback: ScreenshotMaskLevel
): ScreenshotMaskLevel {
  const value = obj[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (
    typeof value !== 'string' ||
    !Object.values(ScreenshotMaskLevel).includes(value as ScreenshotMaskLevel)
  ) {
    warnInvalidField(key, 'a valid ScreenshotMaskLevel');
    return fallback;
  }
  return value as ScreenshotMaskLevel;
}
