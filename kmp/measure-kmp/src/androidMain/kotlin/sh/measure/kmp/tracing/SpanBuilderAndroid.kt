package sh.measure.kmp.tracing

import sh.measure.android.tracing.SpanBuilder as AndroidSpanBuilder

internal class AndroidSpanBuilderWrapper(
    private val delegate: AndroidSpanBuilder,
) : SpanBuilder {
    override fun setParent(span: Span): SpanBuilder = apply {
        delegate.setParent((span as AndroidSpanWrapper).delegate)
    }

    override fun startSpan(): Span = AndroidSpanWrapper(delegate.startSpan())
    override fun startSpan(timeMs: Long): Span = AndroidSpanWrapper(delegate.startSpan(timeMs))
}

internal fun AndroidSpanBuilder.toKmp(): SpanBuilder = AndroidSpanBuilderWrapper(this)
