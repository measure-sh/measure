package sh.measure.android.tracing

interface SpanBuilder {
    fun setParent(span: Span): SpanBuilder
    fun setNoParent(): SpanBuilder
    fun startSpan(): Span
    fun startSpan(timeMs: Long): Span
}
