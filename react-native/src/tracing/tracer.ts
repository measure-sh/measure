import type { SpanBuilder } from "./spanBuilder";

/**
 * A protocol to create and manage tracing spans.
 */
export interface Tracer {
    /**
     * Creates a new SpanBuilder instance for configuring and creating a span.
     * @param name The name of the span to be created.
     * @returns A SpanBuilder instance.
     */
    spanBuilder(name: string): SpanBuilder;

    /**
     * Retrieves the value for the 'traceparent' header corresponding to the given span.
     * @param span The Span instance.
     * @returns The 'traceparent' header value (e.g., '00-traceid-spanid-01').
     */
    getTraceParentHeaderValue(span: Span): string;

    /**
     * Retrieves the standard key for the trace parent header (usually 'traceparent').
     * @returns The trace parent header key.
     */
    getTraceParentHeaderKey(): string;
}