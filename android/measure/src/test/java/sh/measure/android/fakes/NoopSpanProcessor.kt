package sh.measure.android.fakes

import sh.measure.android.tracing.InternalSpan
import sh.measure.android.tracing.SpanProcessor

internal class NoopSpanProcessor : SpanProcessor {
    override fun onStart(span: InternalSpan) {
        // No-op
    }

    override fun onEnding(span: InternalSpan) {
        // No-op
    }

    override fun onEnded(span: InternalSpan) {
        // No-op
    }
}
