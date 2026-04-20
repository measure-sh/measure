package sh.measure.kmp.tracing

/**
 * Interface for configuring and creating a new [Span].
 */
interface SpanBuilder {
    /**
     * Sets the parent span for the span being built.
     */
    fun setParent(span: Span): SpanBuilder

    /**
     * Creates and starts a new span with the current time.
     */
    fun startSpan(): Span

    /**
     * Creates and starts a new span with the specified start time.
     */
    fun startSpan(timeMs: Long): Span
}
