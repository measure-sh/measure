package sh.measure.android.fakes

import sh.measure.android.tracing.ReadWriteSpan
import sh.measure.android.tracing.SpanProcessor

internal class NoopSpanProcessor : SpanProcessor {
    override fun onStart(span: ReadWriteSpan) {
        // No-op
    }

    override fun onEnding(span: ReadWriteSpan) {
        // No-op
    }

    override fun onEnded(span: ReadWriteSpan) {
        // No-op
    }
}
