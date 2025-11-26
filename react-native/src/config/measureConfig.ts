import { DefaultConfig } from './defaultConfig';

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
  userJourneysSamplingRate: number;

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
  userJourneysSamplingRate: number;
  traceSamplingRate: number;
  trackHttpHeaders: boolean;
  trackHttpBody: boolean;
  httpHeadersBlocklist: string[];
  httpUrlBlocklist: string[];
  httpUrlAllowlist: string[];
  autoStart: boolean;

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
   * @param userJourneysSamplingRate Configures sampling rate for sessions that track "user journeys". This feature shows traffic of users across different parts of the app.
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
   */
  constructor(
    enableLogging: boolean | null,
    samplingRateForErrorFreeSessions: number | null,
    coldLaunchSamplingRate: number | null,
    warmLaunchSamplingRate: number | null,
    hotLaunchSamplingRate: number | null,
    userJourneysSamplingRate: number | null,
    traceSamplingRate: number | null,
    trackHttpHeaders: boolean | null,
    trackHttpBody: boolean | null,
    httpHeadersBlocklist: string[] | null,
    httpUrlBlocklist: string[] | null,
    httpUrlAllowlist: string[] | null,
    autoStart: boolean | null
  ) {
    this.enableLogging = enableLogging ?? DefaultConfig.enableLogging;
    this.samplingRateForErrorFreeSessions = samplingRateForErrorFreeSessions ?? DefaultConfig.sessionSamplingRate;
    this.coldLaunchSamplingRate = coldLaunchSamplingRate ?? DefaultConfig.coldLaunchSamplingRate;
    this.warmLaunchSamplingRate = warmLaunchSamplingRate ?? DefaultConfig.warmLaunchSamplingRate;
    this.hotLaunchSamplingRate = hotLaunchSamplingRate ?? DefaultConfig.hotLaunchSamplingRate;
    this.userJourneysSamplingRate = userJourneysSamplingRate ?? DefaultConfig.userJourneysSamplingRate;
    this.traceSamplingRate = traceSamplingRate ?? DefaultConfig.traceSamplingRate;
    this.trackHttpHeaders = trackHttpHeaders ?? DefaultConfig.trackHttpHeaders;
    this.trackHttpBody = trackHttpBody ?? DefaultConfig.trackHttpBody;
    this.httpHeadersBlocklist = httpHeadersBlocklist ?? DefaultConfig.httpHeadersBlocklist;
    this.httpUrlBlocklist = httpUrlBlocklist ?? DefaultConfig.httpUrlBlocklist;
    this.httpUrlAllowlist = httpUrlAllowlist ?? DefaultConfig.httpUrlAllowlist;
    this.autoStart = autoStart ?? DefaultConfig.autoStart;

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
  }
}
