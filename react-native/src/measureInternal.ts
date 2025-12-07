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
      signalProcessor: this.measureInitializer.signalProcessor,
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
        new MeasureConfig({
                enableLogging: DefaultConfig.enableLogging,
                samplingRateForErrorFreeSessions: DefaultConfig.sessionSamplingRate,
                coldLaunchSamplingRate: DefaultConfig.coldLaunchSamplingRate,
                warmLaunchSamplingRate: DefaultConfig.warmLaunchSamplingRate,
                hotLaunchSamplingRate: DefaultConfig.hotLaunchSamplingRate,
                journeySamplingRate: DefaultConfig.journeySamplingRate,
                traceSamplingRate: DefaultConfig.traceSamplingRate,
                trackHttpHeaders: DefaultConfig.trackHttpHeaders,
                trackHttpBody: DefaultConfig.trackHttpBody,
                httpHeadersBlocklist: DefaultConfig.httpHeadersBlocklist,
                httpUrlBlocklist: DefaultConfig.httpUrlBlocklist,
                httpUrlAllowlist: DefaultConfig.httpUrlAllowlist,
                autoStart: DefaultConfig.autoStart,
                screenshotMaskLevel: DefaultConfig.screenshotMaskLevel,
                maxDiskUsageInMb: DefaultConfig.maxDiskUsageInMb,
              }),
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

  setUserId(userId: string): void {
    return this.measureInitializer.nativeApiProcessor.setUserId(userId);
  }

  clearUserId(): void {
    return this.measureInitializer.nativeApiProcessor.clearUserId();
  }

  trackHttpEvent(params: {
    url: string;
    method: string;
    startTime: number;
    endTime: number;
    client?: string;
    statusCode?: number;
    error?: string;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBody?: string;
    responseBody?: string;
  }): Promise<void> {
    return this.measureInitializer.userTriggeredEventCollector.trackHttpEvent(params);
  }
}
