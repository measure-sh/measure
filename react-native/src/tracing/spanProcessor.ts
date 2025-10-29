import type { ConfigProvider } from "../config/configProvider";
import type { ISignalProcessor } from "../events/signalProcessor";
import type { Logger } from "../utils/logger";
import type { InternalSpan } from "./internalSpan";
import type { SpanData } from "./spanData";

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
}

export class SpanProcessor implements ISpanProcessor {
    logger: Logger;
    signalProcessor: ISignalProcessor;
    configProvider: ConfigProvider;

    constructor(
        logger: Logger,
        signalProcessor: ISignalProcessor,
        configProvider: ConfigProvider
    ) {
        this.logger = logger;
        this.signalProcessor = signalProcessor;
        this.configProvider = configProvider;
    }

    onStart(span: InternalSpan): void {
        this.logger.log('debug', `Span started: ${span.name}`, null, { step: 'onStart' });

        // const attributes = new Attributes({});
        // TODO: Process attributes

        // span.setInternalAttribute(attributes);
    }

    onEnding(_span: InternalSpan): void {
        // No-op in current implementation
    }

    onEnded(span: InternalSpan): void {
        this.logger.log('debug', `Span ending: ${span.name}`, null, { step: 'onEnded' });

        const spanData = span.toSpanData();
        const validSpanData = this.sanitize(spanData);

        if (validSpanData) {
            this.signalProcessor.trackSpan(validSpanData);
            this.logger.log('debug',
                `Span ended: ${validSpanData.name}, duration: ${validSpanData.duration}`,
                null,
                { duration: validSpanData.duration }
            );
        }
    }

    /**
     * Sanitizes the span data according to configuration rules.
     * @param spanData The span data to sanitize.
     * @returns a valid SpanDataInternal object that should be processed, or null if it should be discarded.
     */
    private sanitize(spanData: SpanData): SpanData | null {
        const { duration, name, checkpoints } = spanData;

        if (duration < 0) {
            this.logger.log('error', `Invalid span: ${name}, duration is negative, span will be dropped`, null, { duration });
            return null;
        }

        // 2. Discard if span name exceeds max length
        if (name.length > this.configProvider.maxSpanNameLength) {
            this.logger.log('error',
                `Invalid span: ${name}, length ${name.length} exceeded max allowed, span will be dropped`,
                null,
                { maxLength: this.configProvider.maxSpanNameLength }
            );
            return null;
        }

        let sanitizedCheckpoints = [...checkpoints];
        const initialSize = sanitizedCheckpoints.length;

        const checkpointsToKeep = sanitizedCheckpoints.filter(checkpoint =>
            checkpoint.name.length <= this.configProvider.maxCheckpointNameLength
        );
        sanitizedCheckpoints = checkpointsToKeep;

        if (sanitizedCheckpoints.length < initialSize) {
            this.logger.log('error',
                `Invalid span: ${name}, dropped ${initialSize - sanitizedCheckpoints.length} checkpoints due to invalid name`,
                null,
                { droppedCount: initialSize - sanitizedCheckpoints.length }
            );
        }

        if (sanitizedCheckpoints.length > this.configProvider.maxCheckpointsPerSpan) {
            this.logger.log('error',
                `Invalid span: ${name}, max checkpoints exceeded, some checkpoints will be dropped`,
                null,
                { maxAllowed: this.configProvider.maxCheckpointsPerSpan }
            );
            sanitizedCheckpoints = sanitizedCheckpoints.slice(0, this.configProvider.maxCheckpointsPerSpan);
        }

        return {
            ...spanData,
            checkpoints: sanitizedCheckpoints,
        };
    }
}