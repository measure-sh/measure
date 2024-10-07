package sh.measure.android.tracing

interface SpanBuilder {
    fun startSpan(): Span
    fun startSpan(timeMs: Long): Span
}
