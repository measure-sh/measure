package sh.measure.android.tracing

/**
 * Used to construct a [Span].
 */
internal interface SpanBuilder {
    /**
     * Sets the parent span. If not set, the current span in scope will be automatically set
     * as parent. If no span is available in scope, this span will be a root span.
     */
    fun setParent(span: Span): SpanBuilder

    /**
     * Force this span to be a root span, regardless of the current span in scope.
     */
    fun setNoParent(): SpanBuilder

    /**
     * Starts a new span.
     *
     * Once the span is started, any other function in the span builder will be ignored.
     */
    fun startSpan(): Span

    /**
     * Starts a new span at the specified [timeMs]. Use when the operation to be traced has already
     * started.
     *
     * @param timeMs The milliseconds since epoch when the span started.
     */
    fun startSpan(timeMs: Long): Span
}
