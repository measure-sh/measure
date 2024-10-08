package sh.measure.android.tracing

internal interface ReadableSpan {
    fun toSpanData(): SpanData
}
