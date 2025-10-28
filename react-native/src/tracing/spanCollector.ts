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
    private readonly tracer: Tracer;
    // Replaced AtomicBool with a standard boolean, relying on JS single-threading.
    private isEnabled: boolean = false;

    constructor(tracer: Tracer) {
        this.tracer = tracer;
    }

    public register(): void {
        this.isEnabled = true;
    }

    public unregister(): void {
        this.isEnabled = false;
    }

    public getTraceParentHeaderValue(span: Span): string {
        return this.tracer.getTraceParentHeaderValue(span);
    }

    public getTraceParentHeaderKey(): string {
        return this.tracer.getTraceParentHeaderKey();
    }

    public createSpan(name: string): SpanBuilder | undefined {
        // Equivalent to guard isEnabled.get() else { return nil }
        if (!this.isEnabled) {
            return undefined;
        }
        return this.tracer.spanBuilder(name);
    }

    public startSpan(name: string, timestampMs?: number): Span {
        // Equivalent to guard isEnabled.get() else { return InvalidSpan() }
        if (!this.isEnabled) {
            return new InvalidSpan();
        }

        const spanBuilder = this.tracer.spanBuilder(name);

        // Swift Int64? -> TypeScript number | undefined
        // The logic for handling optional timestamp is condensed using an optional parameter.
        if (timestampMs !== undefined) {
            return spanBuilder.startSpan(timestampMs);
        }

        return spanBuilder.startSpan();
    }
}