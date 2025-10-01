import type { Client } from './config/clientInfo';
import { DefaultConfig } from './config/defaultConfig';
import { MeasureConfig } from './config/measureConfig';
import * as MeasureErrorHandlers from './exception/measureErrorHandlers';
import type { MeasureInitializer } from './measureInitializer';
import {
  initializeNativeSDK,
  start,
  stop,
  trackEvent as nativeTrackEvent,
} from './native/measureBridge';

export class MeasureInternal {
  private measureInitializer: MeasureInitializer;

  constructor(measureInitializer: MeasureInitializer) {
    this.measureInitializer = measureInitializer;

    MeasureErrorHandlers.setupErrorHandlers({
      onerror: true,
      onunhandledrejection: true,
      patchGlobalPromise: true,
      logger: this.measureInitializer.logger,
      timeProvider: this.measureInitializer.timeProvider,
    });

    this.measureInitializer.logger.internalLog(
      'info',
      'React Native error handlers installed.'
    );
  }

  init(client: Client, config: MeasureConfig | null): Promise<any> {
    return initializeNativeSDK(
      client,
      config ??
        new MeasureConfig(
          DefaultConfig.enableLogging,
          DefaultConfig.sessionSamplingRate,
          DefaultConfig.traceSamplingRate,
          DefaultConfig.trackHttpHeaders,
          DefaultConfig.trackHttpBody,
          DefaultConfig.httpHeadersBlocklist,
          DefaultConfig.httpUrlBlocklist,
          DefaultConfig.httpUrlAllowlist,
          DefaultConfig.autoStart,
          DefaultConfig.trackViewControllerLoadTime
        ),
      this.measureInitializer.logger
    );
  }

  start = (): Promise<any> => {
    return start();
  };

  stop = (): Promise<any> => {
    return stop();
  };

  trackEvent = (
    name: string,
    attributes?: Record<string, string | number | boolean>,
    timestamp?: number
  ): Promise<void> => {
    if (!name || name.length === 0) {
      this.measureInitializer.logger.internalLog(
        'warning',
        '[MeasureInternal] trackEvent called with empty name, ignoring.'
      );
      return Promise.reject(
        new Error('[MeasureInternal] trackEvent called with empty name.')
      );
    }

    const eventTimestamp = timestamp ?? Date.now();

    this.measureInitializer.logger.internalLog(
      'info',
      '[MeasureInternal] trackEvent',
      { name, attributes: attributes ?? {}, timestamp: eventTimestamp }
    );

    // Bridge to native
    return nativeTrackEvent(
      { name }, // data
      'custom', // type
      eventTimestamp,
      attributes ?? {}, // attributes
      {}, // userDefinedAttrs
      true, // userTriggered
      undefined, // sessionId (optional for now)
      undefined, // threadName (optional for now)
      [] // attachments
    )
      .then(() => {
        this.measureInitializer.logger.internalLog(
          'info',
          `[MeasureInternal] Successfully tracked event '${name}'`
        );
      })
      .catch((err) => {
        this.measureInitializer.logger.internalLog(
          'error',
          `[MeasureInternal] Failed to track event '${name}': ${err}`
        );
        throw err;
      });
  };
}
