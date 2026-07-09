import { trackEvent, trackSpan } from '../native/measureBridge';
import type { SpanData } from '../tracing/spanData';
import type { Logger } from '../utils/logger';

const PATCH_ID_KEY = 'patch_id';
const PATCH_VERSION_KEY = 'patch_version';

/**
 * Protocol for processing events and spans.
 */
export interface ISignalProcessor {
  /**
   * Sets the OTA patch identifiers to attach to every event and span tracked
   * by the React Native SDK. Scoping the attributes here ensures they are only
   * added to RN-originated signals and not to native events.
   */
  setPatchInfo(patchId?: string, patchVersion?: string): void;

  /**
   * Tracks a completed span's data.
   * Sends it to the native SDK for storage and export.
   * @param spanData The finalized span data structure.
   */
  trackSpan(spanData: SpanData): Promise<any>;

  /**
   * Tracks a custom event.
   */
  trackEvent(
    data: Record<string, any>,
    type: string,
    timestamp: number,
    attributes?: Record<string, any>,
    userDefinedAttrs?: Record<string, any>,
    userTriggered?: boolean,
    sessionId?: string,
    threadName?: string,
    attachments?: any[]
  ): Promise<any>;
}

export class SignalProcessor implements ISignalProcessor {
  private logger: Logger;
  private patchId?: string;
  private patchVersion?: string;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  setPatchInfo(patchId?: string, patchVersion?: string): void {
    this.patchId = patchId;
    this.patchVersion = patchVersion;
  }

  private withPatchAttributes(
    attributes: Record<string, any>
  ): Record<string, any> {
    if (!this.patchId && !this.patchVersion) {
      return attributes;
    }
    const merged = { ...attributes };
    if (this.patchId) {
      merged[PATCH_ID_KEY] = this.patchId;
    }
    if (this.patchVersion) {
      merged[PATCH_VERSION_KEY] = this.patchVersion;
    }
    return merged;
  }

  async trackSpan(spanData: SpanData): Promise<any> {
    try {
      this.logger.log(
        'debug',
        `[SignalProcessor] Tracking span: ${spanData.name}`,
        null,
        { duration: spanData.duration }
      );

      const attributes = this.withPatchAttributes(spanData.attributes ?? {});
      const userDefinedAttrs = spanData.userDefinedAttrs ?? {};

      const checkpointsDict = (spanData.checkpoints || []).reduce(
        (acc, cp) => {
          acc[cp.name] = cp.timestamp;
          return acc;
        },
        {} as Record<string, number>
      );

      return await trackSpan(
        spanData.name,
        spanData.traceId,
        spanData.spanId,
        spanData.parentId ?? null,
        spanData.startTime,
        spanData.endTime,
        spanData.duration,
        spanData.status,
        attributes,
        userDefinedAttrs,
        checkpointsDict,
        spanData.hasEnded,
        spanData.isSampled
      );
    } catch (err: any) {
      this.logger.log('error', `[SignalProcessor] trackSpan failed: ${err}`);
      throw err;
    }
  }

  trackEvent(
    data: Record<string, any>,
    type: string,
    timestamp: number,
    attributes: Record<string, any> = {},
    userDefinedAttrs: Record<string, any> = {},
    userTriggered = false,
    sessionId?: string,
    threadName?: string,
    attachments: any[] = []
  ): Promise<any> {
    this.logger.log('debug', `[SignalProcessor] Tracking event: ${type}`);
    return trackEvent(
      data,
      type,
      timestamp,
      this.withPatchAttributes(attributes),
      userDefinedAttrs,
      userTriggered,
      sessionId,
      threadName,
      attachments
    );
  }
}
