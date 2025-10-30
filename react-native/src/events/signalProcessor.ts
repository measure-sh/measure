import { trackEvent, trackSpan } from '../native/measureBridge';
import type { SpanData } from '../tracing/spanData';
import type { Logger } from '../utils/logger';
import type { TimeProvider } from '../utils/timeProvider';

/**
 * Protocol for processing events and spans.
 */
export interface ISignalProcessor {
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
  private timeProvider: TimeProvider;

  constructor(logger: Logger, timeProvider: TimeProvider) {
    this.logger = logger;
    this.timeProvider = timeProvider;
  }

  async trackSpan(spanData: SpanData): Promise<any> {
    try {
      this.logger.log(
        'debug',
        `[SignalProcessor] Tracking span: ${spanData.name}`,
        null,
        { duration: spanData.duration }
      );

      const attributes = spanData.attributes ?? {};
      const userDefinedAttrs = spanData.userDefinedAttrs ?? {};

      const checkpointsDict = (spanData.checkpoints || []).reduce(
        (acc, cp) => {
          const numericTimestamp = this.parseCheckpointTimestamp(cp.timestamp);
          acc[cp.name] = numericTimestamp;
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
      attributes,
      userDefinedAttrs,
      userTriggered,
      sessionId,
      threadName,
      attachments
    );
  }

  private parseCheckpointTimestamp(raw: string): number {
    const asNumber = Number(raw);
    if (!isNaN(asNumber)) {
      return asNumber;
    }

    const parsed = Date.parse(raw);
    if (!isNaN(parsed)) {
      return parsed;
    }

    // Fallback: use current provider time
    this.logger.log(
      'warning',
      `[SignalProcessor] Invalid checkpoint timestamp '${raw}', using current time`
    );
    return this.timeProvider.now();
  }
}
