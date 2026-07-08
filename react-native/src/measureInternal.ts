import { MeasureConfig } from './config/measureConfig';
import type { MsrAttachment } from './events/msrAttachment';
import { ErrorReportingManager } from './exception/errorReportingManager';
import { buildExceptionPayload } from './exception/exceptionBuilder';
import type { MeasureInitializer } from './measureInitializer';
import {
  setShakeListener,
  getSessionId as getNativeSessionId,
  enableNativeModule,
  disableNativeModule,
  start as nativeStart,
  stop as nativeStop,
  internalSetPatchId as nativeSetPatchId,
  internalSetPatchVersion as nativeSetPatchVersion,
} from './native/measureBridge';
import type { Span } from './tracing/span';
import type { SpanBuilder } from './tracing/spanBuilder';
import type { ValidAttributeValue } from './utils/attributeValueValidator';

export class MeasureInternal {
  private measureInitializer: MeasureInitializer;
  private shakeHandler?: (() => void) | null;
  private started = false;
  private errorReportingManager: ErrorReportingManager;

  constructor(measureInitializer: MeasureInitializer) {
    this.measureInitializer = measureInitializer;

    this.errorReportingManager = new ErrorReportingManager(
      this.measureInitializer.timeProvider,
      this.measureInitializer.logger,
      this.measureInitializer.signalProcessor
    );
    this.errorReportingManager.enable();
  }

  registerCollectors(): void {
    this.measureInitializer.customEventCollector.register();
    this.measureInitializer.userTriggeredEventCollector.register();
    this.measureInitializer.spanCollector.register();
    this.measureInitializer.bugReportCollector.register();
  }

  unregisterCollectors(): void {
    this.measureInitializer.customEventCollector.unregister();
    this.measureInitializer.userTriggeredEventCollector.unregister();
    this.measureInitializer.spanCollector.unregister();
    this.measureInitializer.bugReportCollector.unregister();
  }

  async init({ config }: { config: MeasureConfig | null }): Promise<void> {
    this.measureInitializer.configLoader
      .loadDynamicConfig()
      .then((dynamicConfig) => {
        if (dynamicConfig) {
          this.measureInitializer.configProvider.setDynamicConfig(
            dynamicConfig
          );
        }

        this.measureInitializer.spanProcessor.onConfigLoaded();
      })
      .catch((error) => {
        console.error('Failed to load dynamic config', error);
        this.measureInitializer.spanProcessor.onConfigLoaded();
      });

    // config.patchId takes priority (manual / CodePush approach).
    // Falls back to global.__measurePatchId injected by withMeasureConfig()
    // in metro.config.js (automated approach).
    const patchId = config?.patchId ?? (global as any).__measurePatchId;
    if (patchId) {
      nativeSetPatchId(patchId);
    }

    if (config?.patchVersion) {
      nativeSetPatchVersion(config.patchVersion);
    }

    if (config?.autoStart) {
      this.started = true;
      this.registerCollectors();
      enableNativeModule();
      await nativeStart();
    }
  }

  start(): Promise<void> {
    if (this.started) {
      this.measureInitializer.logger.internalLog(
        'warning',
        'Measure.start() called but Measure is already started.'
      );
      return Promise.resolve();
    }
    this.started = true;
    this.errorReportingManager.enable();
    this.registerCollectors();
    enableNativeModule();
    return nativeStart();
  }

  stop(): Promise<void> {
    if (!this.started) {
      this.measureInitializer.logger.internalLog(
        'warning',
        'Measure.stop() called but Measure is not started.'
      );
      return Promise.resolve();
    }
    this.started = false;
    this.errorReportingManager.disable();
    this.unregisterCollectors();
    disableNativeModule();
    return nativeStop();
  }

  trackEvent = ({
    name,
    attributes,
    timestamp,
  }: {
    name: string;
    attributes?: Record<string, ValidAttributeValue>;
    timestamp?: number;
  }): Promise<void> =>
    this.measureInitializer.customEventCollector.trackCustomEvent({
      name,
      attributes,
      timestamp,
    });

  getCurrentTime(): number {
    return this.measureInitializer.timeProvider.now();
  }

  trackScreenView = ({
    screenName,
    attributes,
  }: {
    screenName: string;
    attributes?: Record<string, ValidAttributeValue>;
  }): Promise<void> =>
    this.measureInitializer.userTriggeredEventCollector.trackScreenView({
      screenName,
      attributes,
    });

  launchBugReport = (
    params: {
      takeScreenshot?: boolean;
      bugReportConfig?: Record<string, any>;
      attributes?: Record<string, ValidAttributeValue>;
    } = {}
  ): Promise<void> =>
    this.measureInitializer.bugReportCollector.launchBugReport(params);

  onShake({ handler }: { handler?: (() => void) | null }): void {
    this.shakeHandler = handler;
    const enable = !!this.shakeHandler;
    setShakeListener(enable, this.shakeHandler ?? undefined);

    this.measureInitializer.logger.internalLog(
      'info',
      enable ? 'Shake listener enabled.' : 'Shake listener disabled.'
    );
  }

  async captureScreenshot(): Promise<MsrAttachment | null> {
    return this.measureInitializer.screenshotCollector.capture();
  }

  createSpan({ name }: { name: string }): SpanBuilder | undefined {
    return this.measureInitializer.spanCollector.createSpan({ name });
  }

  startSpan({
    name,
    timestampMs,
  }: {
    name: string;
    timestampMs?: number;
  }): Span {
    return this.measureInitializer.spanCollector.startSpan({
      name,
      timestampMs,
    });
  }

  getTraceParentHeaderValue({ span }: { span: Span }): string {
    return this.measureInitializer.spanCollector.getTraceParentHeaderValue({
      span,
    });
  }

  getTraceParentHeaderKey(): string {
    return this.measureInitializer.spanCollector.getTraceParentHeaderKey();
  }

  setUserId({ userId }: { userId: string }): void {
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
    client?: string | null;
    statusCode?: number | null;
    error?: string | null;
    requestHeaders?: Record<string, string> | null;
    responseHeaders?: Record<string, string> | null;
    requestBody?: string | null;
    responseBody?: string | null;
  }): Promise<void> {
    return this.measureInitializer.userTriggeredEventCollector.trackHttpEvent(
      params
    );
  }

  trackBugReport(params: {
    description: string;
    attachments?: MsrAttachment[];
    attributes?: Record<string, ValidAttributeValue>;
  }): Promise<void> {
    return this.measureInitializer.bugReportCollector.trackBugReport(params);
  }

  trackError({
    error,
    attributes,
  }: {
    error: unknown;
    attributes?: Record<string, ValidAttributeValue>;
  }): Promise<void> {
    const payload = buildExceptionPayload(error, 'handled', false);
    return this.measureInitializer.signalProcessor
      .trackEvent(
        payload,
        'exception',
        this.measureInitializer.timeProvider.now(),
        {},
        attributes ?? {}
      )
      .catch((err) => {
        this.measureInitializer.logger.log(
          'error',
          'Failed to track error',
          err
        );
      });
  }

  getSessionId(): Promise<string | null> {
    return getNativeSessionId().catch(() => {
      this.measureInitializer.logger.internalLog(
        'warning',
        'Failed to fetch session ID from native layer.'
      );
      return null;
    });
  }
}
