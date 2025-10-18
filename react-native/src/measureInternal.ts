import type { Client } from './config/clientInfo';
import { DefaultConfig } from './config/defaultConfig';
import { MeasureConfig } from './config/measureConfig';
import * as MeasureErrorHandlers from './exception/measureErrorHandlers';
import type { MeasureInitializer } from './measureInitializer';
import {
  initializeNativeSDK,
  start,
  stop,
} from './native/measureBridge';
import type { ValidAttributeValue } from './utils/attributeValueValidator';

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
    if (config?.autoStart) {
      this.registerCollectors();
    }
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
    this.registerCollectors();
    return start();
  };

  stop = (): Promise<any> => {
    return stop();
  };

  trackEvent = (
    name: string,
    attributes?: Record<string, ValidAttributeValue>,
    timestamp?: number
  ): Promise<void> => {
    return this.measureInitializer.customEventCollector.trackCustomEvent(
      name,
      attributes ?? {},
      timestamp
    );
  };

  trackScreenView = (
    screenName: string,
    attributes?: Record<string, ValidAttributeValue>
  ): Promise<void> => {
    return this.measureInitializer.userTriggeredEventCollector.trackScreenView(
      screenName,
      attributes ?? {},
    );
  };

  registerCollectors(): void {
    this.measureInitializer.customEventCollector.register();
    this.measureInitializer.userTriggeredEventCollector.register();
  }

  unregisterCollectors(): void {
    this.measureInitializer.customEventCollector.unregister();
    this.measureInitializer.userTriggeredEventCollector.unregister();
  }
}
