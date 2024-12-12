package sh.measure.android.tracing

/**
 * An interface to create a span.
 */
internal interface Tracer {
    fun spanBuilder(name: String): SpanBuilder
    fun getTraceParentHeaderValue(span: Span): String
    fun getTraceParentHeaderKey(): String
}
