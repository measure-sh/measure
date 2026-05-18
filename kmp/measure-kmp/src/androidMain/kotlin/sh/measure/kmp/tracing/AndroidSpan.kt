package sh.measure.kmp.tracing

import sh.measure.kmp.attributes.AttributeValue
import sh.measure.kmp.attributes.toAndroid
import sh.measure.android.tracing.Span as SdkSpan
import sh.measure.android.tracing.SpanStatus as SdkSpanStatus

internal class AndroidSpan(internal val delegate: SdkSpan) : Span {
    override val traceId: String get() = delegate.traceId
    override val spanId: String get() = delegate.spanId
    override val parentId: String? get() = delegate.parentId
    override val isSampled: Boolean get() = delegate.isSampled

    override fun setStatus(status: SpanStatus): Span = apply {
        delegate.setStatus(status.toAndroid())
    }

    override fun setParent(parentSpan: Span): Span = apply {
        delegate.setParent(parentSpan.unwrap())
    }

    override fun setCheckpoint(name: String): Span = apply { delegate.setCheckpoint(name) }
    override fun setName(name: String): Span = apply { delegate.setName(name) }
    override fun setAttribute(key: String, value: String): Span = apply { delegate.setAttribute(key, value) }
    override fun setAttribute(key: String, value: Long): Span = apply { delegate.setAttribute(key, value) }
    override fun setAttribute(key: String, value: Int): Span = apply { delegate.setAttribute(key, value) }
    override fun setAttribute(key: String, value: Double): Span = apply { delegate.setAttribute(key, value) }
    override fun setAttribute(key: String, value: Boolean): Span = apply { delegate.setAttribute(key, value) }

    override fun setAttributes(attributes: Map<String, AttributeValue>): Span = apply {
        delegate.setAttributes(attributes.toAndroid())
    }

    override fun removeAttribute(key: String): Span = apply { delegate.removeAttribute(key) }
    override fun end(): Span = apply { delegate.end() }
    override fun end(timestamp: Long): Span = apply { delegate.end(timestamp) }
    override fun hasEnded(): Boolean = delegate.hasEnded()
    override fun getDuration(): Long = delegate.getDuration()
}

internal fun SpanStatus.toAndroid(): SdkSpanStatus = when (this) {
    SpanStatus.Unset -> SdkSpanStatus.Unset
    SpanStatus.Ok -> SdkSpanStatus.Ok
    SpanStatus.Error -> SdkSpanStatus.Error
}

internal fun SdkSpan.toKmp(): Span = AndroidSpan(this)

internal fun Span.unwrap(): SdkSpan {
    check(this is AndroidSpan) {
        "Span must be created via Measure.startSpan or Measure.createSpanBuilder; " +
            "got ${this::class}"
    }
    return delegate
}
