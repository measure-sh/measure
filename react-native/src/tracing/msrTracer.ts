import type { IIdProvider } from "../utils/idProvider";
import type { Logger } from "../utils/logger";
import type { TimeProvider } from "../utils/timeProvider";
import { MsrSpanBuilder } from "./msrSpanBuilder";
import type { Span } from "./span";
import type { SpanBuilder } from "./spanBuilder";
import type { ISpanProcessor } from "./spanProcessor";
import type { Tracer } from "./tracer";
import type { ITraceSampler } from "./traceSampler";

export class MsrTracer implements Tracer {
    logger: Logger;
    idProvider: IIdProvider;
    timeProvider: TimeProvider;
    spanProcessor: ISpanProcessor;
    traceSampler: ITraceSampler;

    constructor(
        logger: Logger,
        idProvider: IIdProvider,
        timeProvider: TimeProvider,
        spanProcessor: ISpanProcessor,
        traceSampler: ITraceSampler
    ) {
        this.logger = logger;
        this.idProvider = idProvider;
        this.timeProvider = timeProvider;
        this.spanProcessor = spanProcessor;
        this.traceSampler = traceSampler;
    }

    public spanBuilder(name: string): SpanBuilder {
        // We delegate the creation of the SpanBuilder, passing all necessary dependencies.
        // NOTE: MsrSpanBuilder must be imported or defined elsewhere.
        return new MsrSpanBuilder(
            name,
            this.idProvider,
            this.timeProvider,
            this.spanProcessor,
            this.traceSampler,
            this.logger
        );
    }

    public getTraceParentHeaderValue(span: Span): string {
        // Implementation follows the W3C Trace Context format:
        // {version}-{traceId}-{spanId}-{traceFlags}
        const version = "00";
        const traceId = span.traceId;
        const spanId = span.spanId;
        // traceFlags: '01' if sampled, '00' otherwise.
        const sampledFlag = span.isSampled ? "01" : "00";

        // Template literal (backticks) replaces Swift's string interpolation
        return `${version}-${traceId}-${spanId}-${sampledFlag}`;
    }

    public getTraceParentHeaderKey(): string {
        return "traceparent";
    }
}