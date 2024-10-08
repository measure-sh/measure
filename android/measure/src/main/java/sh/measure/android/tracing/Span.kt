package sh.measure.android.tracing

interface Span {
    val traceId: String
    val spanId: String
    val name: String
    fun setStatus(status: SpanStatus): Span
    fun end(): Span
    fun end(timeMs: Long): Span
    fun hasEnded(): Boolean
    fun toSpanData(): SpanData
    fun makeCurrent(): Scope

    companion object {
        internal fun current(): Span? {
            return SpanStorage.instance.current()
        }
    }
}
