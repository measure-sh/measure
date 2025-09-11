import type { Client } from './config/clientInfo';
import { MeasureConfig } from './config/measureConfig';
import {
  BaseMeasureInitializer,
  type MeasureInitializer,
} from './measureInitializer';
import { MeasureInternal } from './measureInternal';

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
   * true    // trackViewControllerLoadTime
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

        _measureInitializer = new BaseMeasureInitializer(client);
        _measureInternal = new MeasureInternal(_measureInitializer);

        _measureInternal.init(client, config)
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
      return Promise.reject(new Error('Measure is not initialized. Call init() first.'));
    }
    return _measureInternal.start();
  },

  /**
   * Stop the Measure SDK.
   */
  stop(): Promise<any> {
    if (!_measureInternal) {
      return Promise.reject(new Error('Measure is not initialized. Call init() first.'));
    }
    return _measureInternal.stop();
  },
};
