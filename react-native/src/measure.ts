import type { Client } from './config/clientInfo';
import { MeasureConfig } from './config/measureConfig';
import {
  BaseMeasureInitializer,
  type MeasureInitializer,
} from './measureInitializer';
import { MeasureInternal } from './measureInternal';
import { InvalidSpan } from './tracing/invalidSpan';
import type { Span } from './tracing/span';
import type { SpanBuilder } from './tracing/spanBuilder';
import type { ValidAttributeValue } from './utils/attributeValueValidator';

let _initializationPromise: Promise<void> | null = null;
let _measureInitializer: MeasureInitializer;
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
   * import { Measure, Client, BaseMeasureConfig } from '@measure/react-native';
   *
   * const client = new Client('your-api-key', 'https://api.measure.sh');
   *
   * const measureConfig = new MeasureConfig(
   * true,   // enableLogging
   * 0.7,    // samplingRateForErrorFreeSessions
   * 0.1,    // traceSamplingRate
   * false,  // trackHttpHeaders
   * false,  // trackHttpBody
   * [],     // httpHeadersBlocklist
   * [],     // httpUrlBlocklist
   * [],     // httpUrlAllowlist
   * false,  // autoStart
   * );
   *
   * Measure.init(client, measureConfig);
   *
   */
  init(client: Client, config: MeasureConfig | null): Promise<any> {
    if (_initializationPromise) {
      console.warn('Measure SDK is already initialized or being initialized.');
      return _initializationPromise;
    }

    _initializationPromise = new Promise((resolve, reject) => {
      try {
        console.info('Initializing Measure SDK ...');

        _measureInitializer = new BaseMeasureInitializer(client, config);
        _measureInternal = new MeasureInternal(_measureInitializer);

        _measureInternal
          .init(client, config)
          .then(() => resolve())
          .catch((error) => {
            _initializationPromise = null;
            reject(error);
          });
      } catch (error) {
        _initializationPromise = null;
        reject(error);
      }
    });

    return _initializationPromise;
  },

  /**
   * Start the Measure SDK manually (if `autoStart` is false).
   */
  start(): Promise<any> {
    if (!_measureInternal) {
      return Promise.reject(
        new Error('Measure is not initialized. Call init() first.')
      );
    }
    return _measureInternal.start();
  },

  /**
   * Stop the Measure SDK.
   */
  stop(): Promise<any> {
    if (!_measureInternal) {
      return Promise.reject(
        new Error('Measure is not initialized. Call init() first.')
      );
    }
    return _measureInternal.stop();
  },

  /**
   * Tracks a custom event with optional attributes and timestamp.
   *
   * Event names should be clear and consistent to aid in dashboard searches.
   *
   * For now, this simply logs the event and its attributes to the console.
   * A future version will send the event to the Measure SDK for full tracking.
   *
   * @param name - The name of the event (max 64 characters).
   * @param attributes - Optional key-value pairs providing additional context.
   * @param timestamp - Optional timestamp in milliseconds (defaults to current time).
   *
   * @example
   * ```ts
   * import { Measure } from '@measure/react-native';
   *
   * Measure.trackEvent("user_signup", {
   *   user_name: "Alice",
   *   premium_user: true,
   *   signup_age: 23,
   * }).catch((err) => {
   *   console.error("Failed to track event:", err);
   * });
   * ```
   */
  trackEvent(
    name: string,
    attributes?: Record<string, ValidAttributeValue>,
    timestamp?: number
  ): Promise<void> {
    if (!_measureInternal) {
      return Promise.reject(
        new Error('Measure is not initialized. Call init() first.')
      );
    }

    return _measureInternal.trackEvent(name, attributes, timestamp);
  },

  /**
   * Tracks a screen view event with optional attributes.
   *
   * This method should be used if your app uses a custom navigation system
   * and you want to manually record screen view events.
   *
   * @param screenName - The name of the screen being viewed.
   * @param attributes - Optional key-value pairs providing additional context.
   *
   * @example
   * ```ts
   * import { Measure } from '@measure/react-native';
   *
   * Measure.trackScreenView("Home", {
   *   user_name: "Alice",
   *   premium_user: true,
   * });
   * ```
   */
  trackScreenView(
    screenName: string,
    attributes?: Record<string, ValidAttributeValue>
  ): Promise<void> {
    if (!_measureInternal) {
      return Promise.reject(
        new Error('Measure is not initialized. Call init() first.')
      );
    }

    return _measureInternal.trackScreenView(screenName, attributes);
  },

  /**
   * Returns the current time in milliseconds since epoch (Int64 equivalent).
   *
   * @returns The current time in milliseconds since epoch.
   */
  getCurrentTime(): number {
    if (!_measureInternal) {
      console.warn('Measure is not initialized. Returning standard Date.now().');
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
  startSpan(name: string): Span {
    if (!_measureInternal) {
      return new InvalidSpan();
    }
    return _measureInternal.startSpan(name);
  },

  /**
   * Starts a new performance tracing span with the specified name and start timestamp.
   *
   * @param name - The name to identify this span.
   * @param timestampMs - The milliseconds since epoch when the span started.
   * @returns A new Span instance if the SDK is initialized, or an invalid no-op span if not initialized.
   */
  startSpanWithTimestamp(name: string, timestampMs: number): Span {
    if (!_measureInternal) {
      return new InvalidSpan();
    }
    // Assuming MeasureInternal has a method to call the Tracer/Collector with a timestamp
    return _measureInternal.startSpan(name, timestampMs);
  },

  /**
   * Creates a configurable span builder for deferred span creation.
   *
   * @param name - The name to identify this span.
   * @returns A SpanBuilder instance to configure the span if the SDK is initialized, or undefined if not.
   */
  createSpanBuilder(name: string): SpanBuilder | undefined {
    if (!_measureInternal) {
      return undefined;
    }
    return _measureInternal.createSpan(name);
  },

  /**
   * Returns the W3C traceparent header value for the given span.
   *
   * @param span - The span to extract the traceparent header value from.
   * @returns A W3C trace context compliant header value (e.g., '00-traceId-spanId-01').
   */
  getTraceParentHeaderValue(span: Span): string {
    return _measureInternal.getTraceParentHeaderValue(span);
  },

  /**
   * Returns the W3C traceparent header key/name.
   *
   * @returns The standardized header key 'traceparent'.
   */
  getTraceParentHeaderKey(): string {
    return _measureInternal.getTraceParentHeaderKey();
  },
};
