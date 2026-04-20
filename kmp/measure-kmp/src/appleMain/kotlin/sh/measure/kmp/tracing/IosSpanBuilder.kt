package sh.measure.kmp.tracing

import kotlinx.cinterop.ExperimentalForeignApi
import sh.measure.ios.bindings.MsrObjCSpanBuilder

@OptIn(ExperimentalForeignApi::class)
internal class IosSpanBuilder(
    private val delegate: MsrObjCSpanBuilder,
) : SpanBuilder {
    override fun setParent(span: Span): SpanBuilder = apply {
        delegate.setParent(span.unwrap())
    }

    override fun startSpan(): Span = IosSpan(delegate.startSpan())
    override fun startSpan(timeMs: Long): Span = IosSpan(delegate.startSpanWithTimestamp(timeMs))
}
