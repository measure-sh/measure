import { DefaultConfig } from './defaultConfig';
import type { ScreenshotMaskLevel } from './screenshotMaskLevel';

/**
 * Configuration for the Measure SDK. Used to customize the behavior of the SDK on initialization.
 */
export interface MeasureConfigInterface {
  /**
   * Whether to enable internal SDK logging.
   * Defaults to `false`.
   */
  enableLogging: boolean;

  /**
   * The sampling rate for non-crashed sessions. Must be between 0.0 and 1.0.
   * For example, a value of `0.5` will export only 50% of the non-crashed sessions,
   * and a value of `0` will disable sending non-crashed sessions to the server.
   * Defaults to 1.0.
   */
  samplingRateForErrorFreeSessions: number;

  /**
   * The sampling rate for cold launch events. Must be between 0.0 and 1.0.
   * For example, a value of `0.5` will export only 50% of the cold launch events,
   * and a value of `0` will disable sending cold launch events to the server.
   * Defaults to 0.01.
   */
  coldLaunchSamplingRate: number;

  /**
   * The sampling rate for warm launch events. Must be between 0.0 and 1.0.
   * For example, a value of `0.5` will export only 50% of the warm launch events,
   * and a value of `0` will disable sending warm launch events to the server.
   * Defaults to 0.01.
   */
  warmLaunchSamplingRate: number;

  /**
   * The sampling rate for hot launch events. Must be between 0.0 and 1.0.
   * For example, a value of `0.5` will export only 50% of the hot launch events,
   * and a value of `0` will disable sending hot launch events to the server.
   * Defaults to 0.01.
   */
  hotLaunchSamplingRate: number;

  /**
   * Configures sampling rate for sessions that track "user journeys". This feature shows
   * traffic of users across different parts of the app. When set to 0, the journey will only
   * be generated from crashed sessions or sessions collected using
   * [samplingRateForErrorFreeSessions].
   *
   * Defaults to 0.
   *
   * If a value of 0.1 is set, then 10% of the sessions will contain events required
   * to build the journey which includes screen view, lifecycle activity & lifecycle fragments for android and lifecycle view controller for iOS.
   *
   * **Note: a higher value for this config can significantly increase the number of events
   * collected for your app.**
   */
  journeySamplingRate: number;

  /**
   * The sampling rate for traces. Must be between 0.0 and 1.0.
   * For example, a value of `0.1` will export only 10% of all traces,
   * a value of `0` will disable exporting of traces.
   * Defaults to 0.1.
   */
  traceSamplingRate: number;

  /**
   * Whether to capture HTTP headers in network requests and responses.
   * Defaults to `false`.
   */
  trackHttpHeaders: boolean;

  /**
   * Whether to capture HTTP body in network requests and responses.
   * Defaults to `false`.
   */
  trackHttpBody: boolean;

  /**
   * List of HTTP headers to not collect with the `http` event for both request and response.
   * Defaults to an empty list. The following headers are always excluded:
   * - Authorization
   * - Cookie
   * - Set-Cookie
   * - Proxy-Authorization
   * - WWW-Authenticate
   * - X-Api-Key
   */
  httpHeadersBlocklist: string[];

  /**
   * Allows disabling collection of `http` events for certain URLs.
   * This is useful to setup if you do not want to collect data for certain endpoints.
   * Note that this config is ignored if httpUrlAllowlist is set.
   *
   * You can:
   * - Disable a domain, eg. example.com
   * - Disable a subdomain, eg. api.example.com
   * - Disable a particular path, eg. example.com/order
   */
  httpUrlBlocklist: string[];

  /**
   * Allows enabling collection of `http` events for only certain URLs.
   * This is useful to setup if you do not want to collect data for all endpoints except for a few.
   *
   * You can:
   * - Enable a domain, eg. example.com
   * - Enable a subdomain, eg. api.example.com
   * - Enable a particular path, eg. example.com/order
   */
  httpUrlAllowlist: string[];

  /**
   * Whether to automatically start the SDK on initialization.
   * Set to false to delay starting the SDK. By default, initializing the SDK also starts tracking.
   * Defaults to true.
   */
  autoStart: boolean;

  /**
   * Allows changing the masking level of screenshots to prevent sensitive information from leaking.
   * Defaults to [ScreenshotMaskLevel.allTextAndMedia].
   */
  screenshotMaskLevel: ScreenshotMaskLevel;

  /**
   * Configures the maximum disk usage in megabytes that the Measure SDK is allowed to use.
   *
   * This is useful to control the amount of disk space used by the SDK for storing session data,
   * crash reports, and other collected information.
   *
   * Defaults to `50MB`. Allowed values are between `20MB` and `1500MB`. Any value outside this
   * range will be clamped to the nearest limit.
   *
   * All Measure SDKs store data to disk and upload it to the server in batches. While the app is
   * in foreground, the data is synced periodically and usually the disk space used by the SDK is
   * low. However, if the device is offline or the server is unreachable, the SDK will continue to
   * store data on disk until it reaches the maximum disk usage limit.
   *
   * Note that the storage usage is not exact and works on estimates and typically the SDK will
   * use much less disk space than the configured limit. When the SDK reaches the maximum disk
   * usage limit, it will start deleting the oldest data to make space for new data.
   */
  maxDiskUsageInMb: number;
}

/**
 * Default implementation of the MeasureConfigInterface.
 */
export class MeasureConfig implements MeasureConfigInterface {
  enableLogging: boolean;
  samplingRateForErrorFreeSessions: number;
  coldLaunchSamplingRate: number;
  warmLaunchSamplingRate: number;
  hotLaunchSamplingRate: number;
  journeySamplingRate: number;
  traceSamplingRate: number;
  trackHttpHeaders: boolean;
  trackHttpBody: boolean;
  httpHeadersBlocklist: string[];
  httpUrlBlocklist: string[];
  httpUrlAllowlist: string[];
  autoStart: boolean;
  screenshotMaskLevel: ScreenshotMaskLevel;
  maxDiskUsageInMb: number;

  /**
   * Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
   *
   * @param enableLogging Enable or disable internal SDK logs. Defaults to `false`.
   * @param samplingRateForErrorFreeSessions Sampling rate for sessions without a crash. The sampling rate is a value between 0 and 1.
   * For example, a value of `0.5` will export only 50% of the non-crashed sessions, and a value of `0` will disable sending non-crashed sessions to the server.
   * @param coldLaunchSamplingRate Sampling rate for cold launch events. The sampling rate is a value between 0 and 1.
   * For example, a value of `0.1` will export only 10% of all cold launch events, a value of `0` will disable exporting of cold launch events.
   * @param warmLaunchSamplingRate Sampling rate for warm launch events. The sampling rate is a value between 0 and 1.
   * For example, a value of `0.1` will export only 10% of all warm launch events, a value of `0` will disable exporting of warm launch events.
   * @param hotLaunchSamplingRate Sampling rate for hot launch events. The sampling rate is a value between 0 and 1.
   * For example, a value of `0.1` will export only 10% of all hot launch events, a value of `0` will disable exporting of hot launch events.
   * @param journeySamplingRate Configures sampling rate for sessions that track "user journeys". This feature shows traffic of users across different parts of the app.
   * When set to 0, the journey will only be generated from crashed sessions or sessions collected using [samplingRateForErrorFreeSessions].
   * Defaults to 0.
   * If a value of 0.1 is set, then 10% of the sessions will contain events required
   * to build the journey which includes screen view, lifecycle activity & lifecycle fragments for android and lifecycle view controller for iOS.
   * @param traceSamplingRate Sampling rate for traces. The sampling rate is a value between 0 and 1.
   * For example, a value of `0.1` will export only 10% of all traces, a value of `0` will disable exporting of traces.
   * @param trackHttpHeaders Whether to capture http headers of a network request and response. Defaults to `false`.
   * @param trackHttpBody Whether to capture http body of a network request and response. Defaults to `false`.
   * @param httpHeadersBlocklist List of HTTP headers to not collect with the `http` event for both request and response. Defaults to an empty list. The following headers are always excluded:
   *   - Authorization
   *   - Cookie
   *   - Set-Cookie
   *   - Proxy-Authorization
   *   - WWW-Authenticate
   *   - X-Api-Key
   * @param httpUrlBlocklist Allows disabling collection of `http` events for certain URLs.
   * This is useful to setup if you do not want to collect data for certain endpoints. Note that this config is ignored if `httpUrlAllowlist` is set. You can:
   *   - Disable a domain, e.g. example.com
   *   - Disable a subdomain, e.g. api.example.com
   *   - Disable a particular path, e.g. example.com/order
   * @param httpUrlAllowlist Allows enabling collection of `http` events for only certain URLs. This is useful to setup if you do not want to collect data for all endpoints except for a few. You can:
   *   - Disable a domain, e.g. example.com
   *   - Disable a subdomain, e.g. api.example.com
   *   - Disable a particular path, e.g. example.com/order
   * @param autoStart Set this to false to delay starting the SDK, by default initializing the SDK also starts tracking.
   * @param screenshotMaskLevel Allows changing the masking level of screenshots to prevent sensitive information from leaking. Defaults to `ScreenshotMaskLevel.allTextAndMedia`.
   * @param maxDiskUsageInMb Configures the maximum disk usage in megabytes that the Measure SDK is allowed to use.
   * This controls the amount of disk space used for session data, crash reports and other persisted items.
   * Defaults to `50` (MB). Allowed values are between `20` and `1500`. Values outside this range will be clamped to the nearest limit.
   */
  constructor(options: Partial<MeasureConfigInterface> = {}) {
    this.enableLogging = options.enableLogging ?? DefaultConfig.enableLogging;
    this.samplingRateForErrorFreeSessions = options.samplingRateForErrorFreeSessions ?? DefaultConfig.sessionSamplingRate;
    this.coldLaunchSamplingRate = options.coldLaunchSamplingRate ?? DefaultConfig.coldLaunchSamplingRate;
    this.warmLaunchSamplingRate = options.warmLaunchSamplingRate ?? DefaultConfig.warmLaunchSamplingRate;
    this.hotLaunchSamplingRate = options.hotLaunchSamplingRate ?? DefaultConfig.hotLaunchSamplingRate;
    this.journeySamplingRate = options.journeySamplingRate ?? DefaultConfig.journeySamplingRate;
    this.traceSamplingRate = options.traceSamplingRate ?? DefaultConfig.traceSamplingRate;
    this.trackHttpHeaders = options.trackHttpHeaders ?? DefaultConfig.trackHttpHeaders;
    this.trackHttpBody = options.trackHttpBody ?? DefaultConfig.trackHttpBody;
    this.httpHeadersBlocklist = options.httpHeadersBlocklist ?? DefaultConfig.httpHeadersBlocklist;
    this.httpUrlBlocklist = options.httpUrlBlocklist ?? DefaultConfig.httpUrlBlocklist;
    this.httpUrlAllowlist = options.httpUrlAllowlist ?? DefaultConfig.httpUrlAllowlist;
    this.autoStart = options.autoStart ?? DefaultConfig.autoStart;
    this.screenshotMaskLevel = options.screenshotMaskLevel ?? DefaultConfig.screenshotMaskLevel;
    this.maxDiskUsageInMb = options.maxDiskUsageInMb ?? DefaultConfig.maxDiskUsageInMb;

    if (
      !(
        this.samplingRateForErrorFreeSessions >= 0 &&
        this.samplingRateForErrorFreeSessions <= 1
      )
    ) {
      console.warn(
        'samplingRateForErrorFreeSessions must be between 0.0 and 1.0'
      );
    }

    if (!(this.traceSamplingRate >= 0 && this.traceSamplingRate <= 1)) {
      console.warn('traceSamplingRate must be between 0.0 and 1.0');
    }

    if (
      !(this.coldLaunchSamplingRate >= 0 && this.coldLaunchSamplingRate <= 1)
    ) {
      console.warn('coldLaunchSamplingRate must be between 0.0 and 1.0');
    }

    if (
      !(this.warmLaunchSamplingRate >= 0 && this.warmLaunchSamplingRate <= 1)
    ) {
      console.warn('warmLaunchSamplingRate must be between 0.0 and 1.0');
    }

    if (!(this.hotLaunchSamplingRate >= 0 && this.hotLaunchSamplingRate <= 1)) {
      console.warn('hotLaunchSamplingRate must be between 0.0 and 1.0');
    }

    if (
      !(
        this.journeySamplingRate >= 0 && this.journeySamplingRate <= 1
      )
    ) {
      console.warn('journeySamplingRate must be between 0.0 and 1.0');
    }

    const MIN_DISK_MB = 20;
    const MAX_DISK_MB = 1500;
    if (this.maxDiskUsageInMb < MIN_DISK_MB) {
      console.warn(
        `maxDiskUsageInMb is below minimum (${MIN_DISK_MB}MB). Clamping to minimum.`
      );
      this.maxDiskUsageInMb = MIN_DISK_MB;
    } else if (this.maxDiskUsageInMb > MAX_DISK_MB) {
      console.warn(
        `maxDiskUsageInMb is above maximum (${MAX_DISK_MB}MB). Clamping to maximum.`
      );
      this.maxDiskUsageInMb = MAX_DISK_MB;
    }
  }
}
