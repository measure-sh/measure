package sh.measure.android.fakes

import sh.measure.android.tracing.InternalSpan
import sh.measure.android.tracing.Span
import sh.measure.android.tracing.SpanProcessor

internal class FakeSpanProcessor : SpanProcessor {
    val startedSpans = mutableListOf<InternalSpan>()
    val endingSpans = mutableListOf<Span>()
    val endedSpans = mutableListOf<Span>()

    override fun onStart(span: InternalSpan) {
        startedSpans += span
    }

    override fun onEnding(span: InternalSpan) {
        endingSpans += span as Span
    }

    override fun onEnded(span: InternalSpan) {
        endedSpans += span as Span
    }

    override fun onConfigLoaded() {
        // no-op
    }
}
