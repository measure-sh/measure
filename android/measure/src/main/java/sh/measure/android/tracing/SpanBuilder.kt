package sh.measure.android.tracing

import sh.measure.android.Measure

/**
 * Interface for configuring and creating a new [Span].
 */
interface SpanBuilder {
    /**
     * Sets the parent span for the span being built.
     *
     * @param span The span to set as parent
     *
     * Note: If no parent is explicitly set, the currently active span (if any) will be used
     * as the parent. If no span is active, a root span will be created.
     */
    fun setParent(span: Span): SpanBuilder

    /**
     * Removes any parent context, ensuring the created span will be a root span.
     *
     * Note: This overrides both explicit parent setting and any current span in scope.
     */
    fun setNoParent(): SpanBuilder

    /**
     * Creates and starts a new span with the current time.
     *
     * @return A new [Span] instance
     *
     * Note: After calling this method, any further builder configurations will be ignored.
     * The start time is automatically set using [Measure.getTimestamp].
     */
    fun startSpan(): Span

    /**
     * Creates and starts a new span with the specified start time.
     *
     * @param timeMs The start time in milliseconds since epoch, obtained via [Measure.getTimestamp]
     * @return A new [Span] instance
     *
     * Note: After calling this method, any further builder configurations will be ignored.
     * Use this method when you need to trace an operation that has already started.
     */
    fun startSpan(timeMs: Long): Span
}
