package sh.measure.kmp.tracing

import sh.measure.android.tracing.SpanBuilder as SdkSpanBuilder

internal class AndroidSpanBuilder(
    private val delegate: SdkSpanBuilder,
) : SpanBuilder {
    override fun setParent(span: Span): SpanBuilder = apply {
        delegate.setParent(span.unwrap())
    }

    override fun startSpan(): Span = AndroidSpan(delegate.startSpan())
    override fun startSpan(timeMs: Long): Span = AndroidSpan(delegate.startSpan(timeMs))
}

internal fun SdkSpanBuilder.toKmp(): SpanBuilder = AndroidSpanBuilder(this)
