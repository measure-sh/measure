import { InvalidSpan } from "./invalidSpan";
import type { Span } from "./span";
import type { SpanBuilder } from "./spanBuilder";
import type { Tracer } from "./tracer";
import type { Logger } from "../utils/logger";

export interface ISpanCollector {
    register(): void;
    unregister(): void;
    getTraceParentHeaderValue(params: { span: Span }): string;
    getTraceParentHeaderKey(): string;
    createSpan(params: { name: string }): SpanBuilder | undefined;
    startSpan(params: { name: string; timestampMs?: number }): Span;
}

/**
 * A concrete implementation of SpanCollector that wraps a Tracer and controls
 * span creation based on an internal enabled flag.
 */
export class SpanCollector implements ISpanCollector {
    tracer: Tracer;
    isEnabled: boolean = false;
    private logger: Logger;

    constructor(tracer: Tracer, logger: Logger) {
        this.tracer = tracer;
        this.logger = logger;
    }

    register(): void {
        this.isEnabled = true;
    }

    unregister(): void {
        this.isEnabled = false;
    }

    getTraceParentHeaderValue({ span }: { span: Span }): string {
        return this.tracer.getTraceParentHeaderValue(span);
    }

    getTraceParentHeaderKey(): string {
        return this.tracer.getTraceParentHeaderKey();
    }

    createSpan({ name }: { name: string }): SpanBuilder | undefined {
        if (!this.isEnabled) {
            this.logger.internalLog('warning', 'Measure SDK is stopped. createSpan() will be ignored.');
            return undefined;
        }
        return this.tracer.spanBuilder(name);
    }

    startSpan({ name, timestampMs }: { name: string; timestampMs?: number }): Span {
        if (!this.isEnabled) {
            this.logger.internalLog('warning', 'Measure SDK is stopped. startSpan() will be ignored.');
            return new InvalidSpan();
        }

        const spanBuilder = this.tracer.spanBuilder(name);

        if (timestampMs !== undefined) {
            return spanBuilder.startSpan(timestampMs);
        }

        return spanBuilder.startSpan();
    }
}