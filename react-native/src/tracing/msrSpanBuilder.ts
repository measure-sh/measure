import type { IIdProvider } from "../utils/idProvider";
import type { Logger } from "../utils/logger";
import type { TimeProvider } from "../utils/timeProvider";
import { MsrSpan } from "./msrSpan";
import type { Span } from "./span";
import type { SpanBuilder } from "./spanBuilder";
import type { ISpanProcessor } from "./spanProcessor";
import type { ITraceSampler } from "./traceSampler";

/**
 * Concrete implementation of the SpanBuilder protocol.
 * It holds the necessary dependencies and configuration to create a new MsrSpan.
 */
export class MsrSpanBuilder implements SpanBuilder {
    private readonly name: string;
    private readonly idProvider: IIdProvider;
    private readonly timeProvider: TimeProvider;
    private readonly spanProcessor: ISpanProcessor;
    private readonly traceSampler: ITraceSampler;
    private readonly logger: Logger;
    
    private parentSpan?: Span;

    constructor(
        name: string,
        idProvider: IIdProvider,
        timeProvider: TimeProvider,
        spanProcessor: ISpanProcessor,
        traceSampler: ITraceSampler,
        logger: Logger
    ) {
        this.name = name;
        this.idProvider = idProvider;
        this.timeProvider = timeProvider;
        this.spanProcessor = spanProcessor;
        this.traceSampler = traceSampler;
        this.logger = logger;
    }

    /**
     * Sets the parent span for the span being built.
     * @param span The span to set as parent
     * @returns The builder instance for method chaining
     */
    public setParent(span: Span): SpanBuilder {
        this.parentSpan = span;
        return this;
    }

    /**
     * Creates and starts a new span with the current time.
     * @returns A new Span instance
     */
    public startSpan(): Span;

    /**
     * Creates and starts a new span with the specified start time.
     * @param timestampMs The start time in milliseconds since epoch
     * @returns A new Span instance
     */
    public startSpan(timestampMs: number): Span;

    /**
     * Implementation for startSpan overloads.
     */
    public startSpan(timestampMs?: number): Span {
        return MsrSpan.startSpan({
            name: this.name,
            logger: this.logger,
            timeProvider: this.timeProvider,
            idProvider: this.idProvider,
            traceSampler: this.traceSampler,
            parentSpan: this.parentSpan,
            spanProcessor: this.spanProcessor,
            timestamp: timestampMs,
        });
    }
}