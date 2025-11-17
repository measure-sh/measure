import { InvalidSpan } from "./invalidSpan";
import type { Span } from "./span";
import type { SpanBuilder } from "./spanBuilder";
import type { Tracer } from "./tracer";

export interface ISpanCollector {
    register(): void;
    unregister(): void;
    getTraceParentHeaderValue(span: Span): string;
    getTraceParentHeaderKey(): string;
    createSpan(name: string): SpanBuilder | undefined;
    startSpan(name: string, timestampMs?: number): Span;
}

/**
 * A concrete implementation of SpanCollector that wraps a Tracer and controls
 * span creation based on an internal enabled flag.
 */
export class SpanCollector implements ISpanCollector {
    tracer: Tracer;
    isEnabled: boolean = false;

    constructor(tracer: Tracer) {
        this.tracer = tracer;
    }

    register(): void {
        this.isEnabled = true;
    }

    unregister(): void {
        this.isEnabled = false;
    }

    getTraceParentHeaderValue(span: Span): string {
        return this.tracer.getTraceParentHeaderValue(span);
    }

    getTraceParentHeaderKey(): string {
        return this.tracer.getTraceParentHeaderKey();
    }

    createSpan(name: string): SpanBuilder | undefined {
        // Equivalent to guard isEnabled.get() else { return nil }
        if (!this.isEnabled) {
            return undefined;
        }
        return this.tracer.spanBuilder(name);
    }

    startSpan(name: string, timestampMs?: number): Span {
        if (!this.isEnabled) {
            return new InvalidSpan();
        }

        const spanBuilder = this.tracer.spanBuilder(name);

        if (timestampMs !== undefined) {
            return spanBuilder.startSpan(timestampMs);
        }

        return spanBuilder.startSpan();
    }
}