package sh.measure.android.tracing

internal interface Tracer {
    fun spanBuilder(name: String): SpanBuilder
}
