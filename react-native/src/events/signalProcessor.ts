import type { SpanData } from "../tracing/spanData";
import type { Logger } from "../utils/logger";

/**
 * Protocol for processing events and spans.
 */
export interface ISignalProcessor {
    /**
     * Tracks a completed span's data, applying necessary processing and storage logic.
     * @param spanData The finalized span data structure.
     */
    trackSpan(spanData: SpanData): void;
}

export class SignalProcessor implements ISignalProcessor {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    public trackSpan(spanData: SpanData): void {
        this.logger.log('debug', `Tracking span: ${spanData.name}`, null, { duration: spanData.duration });
        // TODO: Implementation for processing and storing the span data goes here.
    }

    // TODO: add trackEvent method here
}