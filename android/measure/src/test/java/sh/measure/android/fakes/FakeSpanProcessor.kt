package sh.measure.android.fakes

import sh.measure.android.tracing.ReadWriteSpan
import sh.measure.android.tracing.Span
import sh.measure.android.tracing.SpanProcessor

internal class FakeSpanProcessor : SpanProcessor {
    val startedSpans = mutableListOf<ReadWriteSpan>()
    val endingSpans = mutableListOf<Span>()
    val endedSpans = mutableListOf<Span>()

    override fun onStart(span: ReadWriteSpan) {
        startedSpans += span
    }

    override fun onEnding(span: ReadWriteSpan) {
        endingSpans += span as Span
    }

    override fun onEnded(span: ReadWriteSpan) {
        endedSpans += span as Span
    }
}
