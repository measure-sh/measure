import { ScreenshotMaskLevel } from './screenshotMaskLevel';

export interface IDynamicConfig {
  /** Maximum number of events and spans in a batch. Defaults to 10000. */
  maxEventsInBatch: number;

  /** Duration of session timeline collected with a crash, in seconds. Defaults to 300. */
  crashTimelineDurationSeconds: number;

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

  /** Whether to take a screenshot on crash. Defaults to true. */
  crashTakeScreenshot: boolean;

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
  crashTimelineDurationSeconds: number;
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
  crashTakeScreenshot: boolean;
  anrTakeScreenshot: boolean;
  launchSamplingRate: number;
  gestureClickTakeSnapshot: boolean;
  httpDisableEventForUrls: string[];
  httpTrackRequestForUrls: string[];
  httpTrackResponseForUrls: string[];
  httpBlockedHeaders: string[];

  constructor(values: IDynamicConfig) {
    this.maxEventsInBatch = values.maxEventsInBatch;
    this.crashTimelineDurationSeconds = values.crashTimelineDurationSeconds;
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
    this.crashTakeScreenshot = values.crashTakeScreenshot;
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
      crashTimelineDurationSeconds: 300,
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
      crashTakeScreenshot: true,
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

    return new DynamicConfig({
      maxEventsInBatch: obj['max_events_in_batch'],
      crashTimelineDurationSeconds: obj['crash_timeline_duration'],
      anrTimelineDurationSeconds: obj['anr_timeline_duration'],
      bugReportTimelineDurationSeconds: obj['bug_report_timeline_duration'],
      traceSamplingRate: obj['trace_sampling_rate'],
      journeySamplingRate: obj['journey_sampling_rate'],
      screenshotMaskLevel: obj['screenshot_mask_level'],
      logAutocollectEnabled: obj['log_autocollect_enabled'] ?? false,
      logMinSeverity: obj['log_min_severity'] ?? 16,
      logIgnorePatterns: obj['log_ignore_patterns'] || [],
      cpuUsageInterval: obj['cpu_usage_interval'],
      memoryUsageInterval: obj['memory_usage_interval'],
      crashTakeScreenshot: obj['crash_take_screenshot'],
      anrTakeScreenshot: obj['anr_take_screenshot'],
      launchSamplingRate: obj['launch_sampling_rate'],
      gestureClickTakeSnapshot: obj['gesture_click_take_snapshot'],
      httpDisableEventForUrls: obj['http_disable_event_for_urls'] || [],
      httpTrackRequestForUrls: obj['http_track_request_for_urls'] || [],
      httpTrackResponseForUrls: obj['http_track_response_for_urls'] || [],
      httpBlockedHeaders: obj['http_blocked_headers'] || [],
    });
  }
}
