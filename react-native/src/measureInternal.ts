import type { Client } from './config/clientInfo';
import { DefaultConfig } from './config/defaultConfig';
import { MeasureConfig } from './config/measureConfig';
import * as MeasureErrorHandlers from './exception/measureErrorHandlers';
import type { MeasureInitializer } from './measureInitializer';
import { initializeNativeSDK, start, stop } from './native/measureBridge';
import type { Span } from './tracing/span';
import type { SpanBuilder } from './tracing/spanBuilder';
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
      this.measureInitializer.config ??
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

  getCurrentTime(): number {
    return this.measureInitializer.timeProvider.now();
  }

  trackScreenView = (
    screenName: string,
    attributes?: Record<string, ValidAttributeValue>
  ): Promise<void> => {
    return this.measureInitializer.userTriggeredEventCollector.trackScreenView(
      screenName,
      attributes ?? {}
    );
  };

  registerCollectors(): void {
    this.measureInitializer.customEventCollector.register();
    this.measureInitializer.userTriggeredEventCollector.register();
    this.measureInitializer.spanCollector.register();
  }

  unregisterCollectors(): void {
    this.measureInitializer.customEventCollector.unregister();
    this.measureInitializer.userTriggeredEventCollector.unregister();
    this.measureInitializer.spanCollector.unregister();
  }

  createSpan(name: string): SpanBuilder | undefined {
    return this.measureInitializer.spanCollector.createSpan(name);
  }

  startSpan(name: string, timestampMs?: number): Span {
    return this.measureInitializer.spanCollector.startSpan(name, timestampMs);
  }

  getTraceParentHeaderValue(span: Span): string {
    return this.measureInitializer.spanCollector.getTraceParentHeaderValue(
      span
    );
  }

  getTraceParentHeaderKey(): string {
    return this.measureInitializer.spanCollector.getTraceParentHeaderKey();
  }
}
