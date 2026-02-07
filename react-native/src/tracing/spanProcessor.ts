import type { IConfigProvider } from '../config/configProvider';
import type { ISignalProcessor } from '../events/signalProcessor';
import type { Logger } from '../utils/logger';
import type { InternalSpan } from './internalSpan';
import type { SpanData } from './spanData';
import type { ITraceSampler } from './traceSampler';

export interface ISpanProcessor {
  /**
   * Called when a span is started.
   * @param span The span that was started.
   */
  onStart(span: InternalSpan): void;

  /**
   * Called when a span is about to end.
   * @param span The span that is ending.
   */
  onEnding(span: InternalSpan): void;

  /**
   * Called when a span has ended.
   * @param span The span that has ended.
   */
  onEnded(span: InternalSpan): void;

  /**
   * Called when dynamic config loaded.
   */
  onConfigLoaded(): void;
}

export class SpanProcessor implements ISpanProcessor {
  private logger: Logger;
  private signalProcessor: ISignalProcessor;
  private configProvider: IConfigProvider;
  private sampler: ITraceSampler;

  /**
   * Buffer spans until config is loaded.
   * Once config is loaded, this becomes null.
   */
  private spansBuffer: InternalSpan[] | null = [];

  constructor(
    logger: Logger,
    signalProcessor: ISignalProcessor,
    configProvider: IConfigProvider,
    sampler: ITraceSampler
  ) {
    this.logger = logger;
    this.signalProcessor = signalProcessor;
    this.configProvider = configProvider;
    this.sampler = sampler;
  }

  onStart(span: InternalSpan): void {
    this.logger.log('debug', `Span started: ${span.name}`, null, {
      step: 'onStart',
    });

    span.setInternalAttribute({ thread_name: 'rn_main' });

    // Buffer span until config loads
    this.spansBuffer?.push(span);
  }

  onEnding(_span: InternalSpan): void {
    // no-op
  }

  onEnded(span: InternalSpan): void {
    const isConfigLoaded = this.spansBuffer === null;

    // Config not loaded yet → only sanitize + keep/remove from buffer
    if (!isConfigLoaded) {
      const spanData = span.toSpanData();
      const valid = this.sanitize(spanData);

      if (!valid) {
        // remove invalid span from buffer
        this.spansBuffer = this.spansBuffer?.filter((s) => s !== span) ?? null;
        return;
      }

      this.logger.log(
        'debug',
        `Span ended: ${span.name}, waiting for config to load`
      );

      return;
    }

    // Config already loaded → process immediately
    this.processSpan(span);
  }

  onConfigLoaded(): void {
    const pending = this.spansBuffer;
    this.spansBuffer = null;

    if (!pending || pending.length === 0) {
      return;
    }

    this.logger.log(
      'debug',
      `SpanProcessor: processing ${pending.length} buffered spans`
    );

    for (const span of pending) {
      const shouldSample = this.sampler.shouldSampleTrace(span.traceId);
      span.setSampled(shouldSample);

      if (span.hasEnded()) {
        this.processSpan(span);
      }
    }
  }

  private processSpan(span: InternalSpan): void {
    const spanData = span.toSpanData();
    const validSpanData = this.sanitize(spanData);

    if (!validSpanData) {
      return;
    }

    this.signalProcessor.trackSpan(validSpanData);

    this.logger.log(
      'debug',
      `Span ended: ${validSpanData.name}, duration: ${validSpanData.duration}`,
      null,
      { duration: validSpanData.duration }
    );
  }

  /**
   * Sanitizes the span data according to configuration rules.
   * Returns SpanData if valid, otherwise null.
   */
  private sanitize(spanData: SpanData): SpanData | null {
    const { duration, name, checkpoints } = spanData;

    // Negative duration
    if (duration < 0) {
      this.logger.log(
        'error',
        `Invalid span: ${name}, duration is negative, span will be dropped`
      );
      return null;
    }

    // Blank name (Flutter also checks this)
    if (!name.trim()) {
      this.logger.log(
        'error',
        'Invalid span: name is blank, span will be dropped'
      );
      return null;
    }

    // Span name length
    if (name.length > this.configProvider.maxSpanNameLength) {
      this.logger.log(
        'error',
        `Invalid span: ${name}, length ${name.length} exceeded max allowed, span will be dropped`,
        null,
        { maxLength: this.configProvider.maxSpanNameLength }
      );
      return null;
    }

    // Checkpoints
    let sanitizedCheckpoints = [...checkpoints];
    const initialSize = sanitizedCheckpoints.length;

    sanitizedCheckpoints = sanitizedCheckpoints.filter(
      (c) => c.name.length <= this.configProvider.maxCheckpointNameLength
    );

    if (sanitizedCheckpoints.length < initialSize) {
      this.logger.log(
        'error',
        `Invalid span: ${name}, dropped ${
          initialSize - sanitizedCheckpoints.length
        } checkpoints due to invalid name`
      );
    }

    if (
      sanitizedCheckpoints.length > this.configProvider.maxCheckpointsPerSpan
    ) {
      this.logger.log(
        'error',
        `Invalid span: ${name}, max checkpoints exceeded, some checkpoints will be dropped`
      );

      sanitizedCheckpoints = sanitizedCheckpoints.slice(
        0,
        this.configProvider.maxCheckpointsPerSpan
      );
    }

    return {
      ...spanData,
      checkpoints: sanitizedCheckpoints,
    };
  }
}
