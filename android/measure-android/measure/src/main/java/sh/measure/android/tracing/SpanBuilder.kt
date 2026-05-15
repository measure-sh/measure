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
     */
    fun setParent(span: Span): SpanBuilder

    /**
     * Creates and starts a new span with the current time.
     *
     * @return A new [Span] instance
     *
     * Note: After calling this method, any further builder configurations will be ignored.
     * The start time is automatically set using [Measure.getCurrentTime].
     */
    fun startSpan(): Span

    /**
     * Creates and starts a new span with the specified start time.
     *
     * @param timeMs The start time in milliseconds since epoch, obtained via [Measure.getCurrentTime]
     * @return A new [Span] instance
     *
     * Note: After calling this method, any further builder configurations will be ignored.
     * Use this method when you need to trace an operation that has already started.
     */
    fun startSpan(timeMs: Long): Span
}
