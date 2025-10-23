/**
 * Protocol for configuring and creating a new Span.
 */
export interface SpanBuilder {
    /**
     * Sets the parent span for the span being built.
     * @param span The span to set as parent
     * @returns The builder instance for method chaining
     */
    setParent(span: Span): SpanBuilder;

    /**
     * Creates and starts a new span with the current time.
     * @returns A new Span instance
     *
     * Note: After calling this method, any further builder configurations will be ignored.
     * The start time is automatically set.
     */
    startSpan(): Span;

    /**
     * Creates and starts a new span with the specified start time.
     * @param timestampMs The start time in milliseconds since epoch (Int64 in Swift),
     * obtained via a time measurement utility.
     * @returns A new Span instance
     *
     * Note: After calling this method, any further builder configurations will be ignored.
     * Use this method when you need to trace an operation that has already started.
     */
    startSpan(timestampMs: number): Span;
}