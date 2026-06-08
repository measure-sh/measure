import { MeasureConfig } from './config/measureConfig';
import type { MsrAttachment } from './events/msrAttachment';
import {
  MeasureInitializer,
  type IMeasureInitializer,
} from './measureInitializer';
import { MeasureInternal } from './measureInternal';
import { InvalidSpan } from './tracing/invalidSpan';
import type { Span } from './tracing/span';
import type { SpanBuilder } from './tracing/spanBuilder';
import type { ValidAttributeValue } from './utils/attributeValueValidator';

let _initializationPromise: Promise<void> | null = null;
let _measureInitializer: IMeasureInitializer;
let _measureInternal: MeasureInternal;

export const Measure = {
  /**
   * Initializes the Measure SDK. The SDK must be initialized before using any other methods.
   *
   * It is recommended to initialize the SDK as early as possible in the application startup
   * so that exceptions and other events can be captured from the beginning.
   *
   * An optional BaseMeasureConfig can be passed to configure the SDK. If not provided,
   * the SDK will use default configuration values.
   *
   * Initializing the SDK multiple times will have no effect beyond the first call,
   * and is protected against race conditions by returning the same promise.
   *
   * @param client - A Client object containing the API key and API URL.
   * @param config - (Optional) A BaseMeasureConfig object to customize SDK behavior.
   * @returns A promise that resolves once the SDK is fully initialized.
   * Subsequent calls made while initialization is in progress or already complete
   * will return the same promise. If initialization fails, the promise will reject
   * with the encountered error.
   * @example
   * ts
   * import { Measure, BaseMeasureConfig } from '@measure/react-native';
   *
   * const measureConfig = new MeasureConfig({
   *       enableLogging: true,
   *       autoStart: true,
   *       enableDiagnosticMode: true,
   *     });
   *
   * Measure.init(client, measureConfig);
   *
   */
  init({ config }: { config: MeasureConfig | null }): Promise<any> {
    if (_initializationPromise) {
      console.warn('Measure SDK is already initialized or being initialized.');
      return _initializationPromise;
    }

    _initializationPromise = (async () => {
      console.info('Initializing Measure SDK ...');

      _measureInitializer = new MeasureInitializer(config);
      _measureInternal = new MeasureInternal(_measureInitializer);

      await _measureInternal.init({ config });
    })().catch((error) => {
      _initializationPromise = null;
      throw error;
    });

    return _initializationPromise;
  },

  /**
   * Start the Measure SDK manually (if `autoStart` is false).
   */
  start(): Promise<void> {
    if (!_measureInternal) {
      console.warn('Measure is not initialized. Call init() first.');
      return Promise.resolve();
    }
    return _measureInternal.start();
  },

  /**
   * Stop the Measure SDK.
   */
  stop(): Promise<void> {
    if (!_measureInternal) {
      console.warn('Measure is not initialized. Call init() first.');
      return Promise.resolve();
    }
    return _measureInternal.stop();
  },

  /**
   * Tracks a custom event with optional attributes and timestamp.
   *
   * Event names should be clear and consistent to aid in dashboard searches.
   *
   * @param params.name - The name of the event (max 64 characters).
   * @param params.attributes - Optional key-value pairs providing additional context.
   * @param params.timestamp - Optional timestamp in milliseconds (defaults to current time).
   *
   * @example
   * ```ts
   * import { Measure } from '@measure/react-native';
   *
   * Measure.trackEvent({
   *   name: "user_signup",
   *   attributes: {
   *     user_name: "Alice",
   *     premium_user: true,
   *     signup_age: 23,
   *   },
   * }).catch((err) => {
   *   console.error("Failed to track event:", err);
   * });
   * ```
   */
  trackEvent(params: {
    name: string;
    attributes?: Record<string, ValidAttributeValue>;
    timestamp?: number;
  }): Promise<void> {
    if (!_measureInternal) {
      return Promise.reject(
        new Error('Measure is not initialized. Call init() first.')
      );
    }

    return _measureInternal.trackEvent(params);
  },

  /**
   * Tracks a screen view event with optional attributes.
   *
   * This method should be used if your app uses a custom navigation system
   * and you want to manually record screen view events.
   *
   * @param params.screenName - The name of the screen being viewed.
   * @param params.attributes - Optional key-value pairs providing additional context.
   *
   * @example
   * ```ts
   * import { Measure } from '@measure/react-native';
   *
   * Measure.trackScreenView({
   *   screenName: "Home",
   *   attributes: {
   *     user_name: "Alice",
   *     premium_user: true,
   *   },
   * });
   * ```
   */
  trackScreenView(params: {
    screenName: string;
    attributes?: Record<string, ValidAttributeValue>;
  }): Promise<void> {
    if (!_measureInternal) {
      return Promise.reject(
        new Error('Measure is not initialized. Call init() first.')
      );
    }

    return _measureInternal.trackScreenView(params);
  },

  /**
   * Returns the current time in milliseconds since epoch (Int64 equivalent).
   *
   * @returns The current time in milliseconds since epoch.
   */
  getCurrentTime(): number {
    if (!_measureInternal) {
      console.warn(
        'Measure is not initialized. Returning standard Date.now().'
      );
      return Date.now();
    }
    return _measureInternal.getCurrentTime();
  },

  /**
   * Starts a new performance tracing span with the specified name.
   *
   * @param name - The name to identify this span.
   * @returns A new Span instance if the SDK is initialized, or an invalid no-op span if not initialized.
   */
  startSpan({ name }: { name: string }): Span {
    if (!_measureInternal) {
      return new InvalidSpan();
    }
    return _measureInternal.startSpan({ name });
  },

  /**
   * Starts a new performance tracing span with the specified name and start timestamp.
   *
   * @param params.name - The name to identify this span.
   * @param params.timestampMs - The milliseconds since epoch when the span started.
   * @returns A new Span instance if the SDK is initialized, or an invalid no-op span if not initialized.
   */
  startSpanWithTimestamp(params: { name: string; timestampMs: number }): Span {
    if (!_measureInternal) {
      return new InvalidSpan();
    }
    return _measureInternal.startSpan(params);
  },

  /**
   * Creates a configurable span builder for deferred span creation.
   *
   * @param name - The name to identify this span.
   * @returns A SpanBuilder instance to configure the span if the SDK is initialized, or undefined if not.
   */
  createSpanBuilder({ name }: { name: string }): SpanBuilder | undefined {
    if (!_measureInternal) {
      return undefined;
    }
    return _measureInternal.createSpan({ name });
  },

  /**
   * Returns the W3C traceparent header value for the given span.
   *
   * @param span - The span to extract the traceparent header value from.
   * @returns A W3C trace context compliant header value (e.g., '00-traceId-spanId-01').
   */
  getTraceParentHeaderValue({ span }: { span: Span }): string {
    if (!_measureInternal) {
      return '';
    }
    return _measureInternal.getTraceParentHeaderValue({ span });
  },

  /**
   * Returns the W3C traceparent header key/name.
   *
   * @returns The standardized header key 'traceparent'.
   */
  getTraceParentHeaderKey(): string {
    if (!_measureInternal) {
      return '';
    }
    return _measureInternal.getTraceParentHeaderKey();
  },

  /**
   * Sets the user ID for the current user.
   *
   * User ID is persisted by the native SDK and used across sessions.
   * It is recommended to avoid the use of PII (Personally Identifiable Information) in the
   * user ID, such as email, phone number, or any other sensitive information. Instead, use a hashed
   * or anonymized user ID to protect user privacy.
   *
   * @param userId - A non-empty string identifier.
   */
  setUserId({ userId }: { userId: string }): void {
    if (!_measureInternal) {
      console.warn('Measure is not initialized. Call init() first.');
      return;
    }

    if (typeof userId !== 'string' || userId.trim().length === 0) {
      console.warn('Measure.setUserId requires a non-empty string.');
      return;
    }

    _measureInternal.setUserId({ userId });
  },

  /**
   * Clears the user ID previously set via `setUserId`.
   */
  clearUserId(): void {
    if (!_measureInternal) {
      console.warn('Measure is not initialized. Call init() first.');
      return;
    }

    _measureInternal.clearUserId();
  },

  /**
   * Tracks an HTTP event manually.
   *
   * @param url - The URL to which the request was made
   * @param method - The HTTP method used for the request
   * @param startTime - The time when the HTTP request started (recommended to use a monotonic time source)
   * @param endTime - The time when the HTTP request ended (recommended to use a monotonic time source)
   * @param client - The name of the HTTP client used, optional (defaults to "unknown")
   * @param statusCode - The HTTP status code of the response received
   * @param error - The error if the request fails.
   * @param requestHeaders - The HTTP headers in the request
   * @param responseHeaders - The HTTP headers in the response
   * @param requestBody - An optional request body
   * @param responseBody - An optional response body
   */
  trackHttpEvent(params: {
    url: string;
    method: string;
    startTime: number;
    endTime: number;
    client?: string | null;
    statusCode?: number | null;
    error?: string | null;
    requestHeaders?: Record<string, string> | null;
    responseHeaders?: Record<string, string> | null;
    requestBody?: string | null;
    responseBody?: string | null;
  }): Promise<void> {
    if (!_measureInternal) {
      return Promise.reject(
        new Error('Measure is not initialized. Call init() first.')
      );
    }

    return _measureInternal.trackHttpEvent(params);
  },

  /**
   * Launches the bug report flow, optionally taking a screenshot and attaching metadata.
   *
   * This can be used to allow users or QA testers to report issues directly
   * from within the app, optionally including a screenshot and additional attributes.
   *
   * @param params.takeScreenshot - Set to false to disable screenshot capture. Defaults to true.
   * @param params.bugReportConfig - Optional configuration for customizing the bug report UI.
   * @param params.attributes - Optional metadata key-value pairs describing the context of the report.
   *
   * @example
   * ```ts
   * Measure.launchBugReport({ takeScreenshot: true, bugReportConfig: { theme: "dark" }, attributes: { userId: "123", screen: "Home" } });
   * ```
   */
  launchBugReport(params: {
    takeScreenshot?: boolean;
    bugReportConfig?: Record<string, any>;
    attributes?: Record<string, ValidAttributeValue>;
  } = {}): Promise<void> {
    if (!_measureInternal) {
      return Promise.reject(
        new Error('Measure is not initialized. Call init() first.')
      );
    }
    return _measureInternal.launchBugReport(params);
  },

  /**
   * Registers a shake listener that triggers a callback when a shake gesture is detected.
   *
   * Calling this method with a function enables shake detection.
   * Calling it with `null` or `undefined` disables shake detection.
   *
   * Internally, this delegates to the native SDK’s shake listener support
   * (`Measure.shared.onShake` on iOS and `setShakeListener` on Android).
   *
   * @param handler - A callback function to invoke when a shake is detected, or `null` to disable.
   *
   * @example
   * ```ts
   * import { Measure } from '@measure/react-native';
   *
   * Measure.onShake(() => {
   *   console.log('Shake detected! Opening bug report...');
   *   Measure.launchBugReport();
   * });
   * ```
   */
  onShake({ handler }: { handler?: (() => void) | null }): void {
    if (!_measureInternal) {
      console.warn('Measure is not initialized. Call init() first.');
      return;
    }

    _measureInternal.onShake({ handler });
  },

  /**
   * Captures a screenshot of the current app UI.
   *
   * This method must be called after Measure has been initialized.
   * The screenshot will be redacted based on the privacy level defined in the
   * Measure configuration value `screenshotMaskLevel`
   *
   * The screenshot is captured asynchronously and returned as an `MsrAttachment`.
   * If the capture fails, `null` is returned.
   *
   * @returns A Promise resolving to an `MsrAttachment` containing the redacted screenshot,
   *          or `null` if the screenshot could not be captured.
   */
  captureScreenshot(): Promise<MsrAttachment | null> {
    if (!_measureInternal) {
      return Promise.reject(
        new Error('Measure is not initialized. Call init() first.')
      );
    }

    return _measureInternal.captureScreenshot();
  },

  /**
   * Tracks a custom bug report.
   *
   * This method allows programmatic bug report tracking without showing
   * the default Measure bug report UI.
   *
   * Attachments may include screenshots or images from the gallery.
   *
   * @param params.description - A human-readable description of the bug (max 4000 chars).
   * @param params.attachments - Optional list of MsrAttachment objects (max 5).
   * @param params.attributes - Optional metadata describing the bug context.
   *
   * @example
   * ```ts
   * const screenshot = await Measure.captureScreenshot();
   *
   * Measure.trackBugReport({
   *   description: "Something broke on the Home screen",
   *   attachments: screenshot ? [screenshot] : [],
   *   attributes: { userId: "123", screen: "Home" },
   * });
   * ```
   */
  trackBugReport(params: {
    description: string;
    attachments?: MsrAttachment[];
    attributes?: Record<string, ValidAttributeValue>;
  }): Promise<void> {
    if (!_measureInternal) {
      return Promise.reject(
        new Error('Measure is not initialized. Call init() first.')
      );
    }

    return _measureInternal.trackBugReport(params);
  },

  /**
   * Tracks a handled error with optional attributes.
   *
   * Use this to manually capture exceptions that are caught and handled in your
   * code but are still meaningful to track (e.g., a failed payment, a network
   * error that was gracefully recovered from).
   *
   * @param params.error - The error or value to track.
   * @param params.attributes - Optional key-value pairs providing additional context.
   *
   * @example
   * ```ts
   * try {
   *   await processPayment();
   * } catch (e) {
   *   Measure.trackError({ error: e, attributes: { screen: "Checkout" } });
   * }
   * ```
   */
  trackError(params: {
    error: unknown;
    attributes?: Record<string, ValidAttributeValue>;
  }): Promise<void> {
    if (!_measureInternal) {
      return Promise.reject(
        new Error('Measure is not initialized. Call init() first.')
      );
    }
    return _measureInternal.trackError(params);
  },

  /**
   * Returns the current session ID, or null if the SDK is not initialized.
   *
   * A session represents a continuous period of activity in the app.
   * A new session begins when the app is launched for the first time, or when there's been no activity for a 5-minute period.
   * A session represents a continuous period of app usage.
   */
  getSessionId(): Promise<string | null> {
    if (!_measureInternal) {
      return Promise.reject(
        new Error('Measure is not initialized. Call init() first.')
      );
    }

    return _measureInternal.getSessionId();
  },
};
