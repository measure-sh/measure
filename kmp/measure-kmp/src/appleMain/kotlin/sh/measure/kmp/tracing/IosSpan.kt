package sh.measure.kmp.tracing

import kotlinx.cinterop.ExperimentalForeignApi
import sh.measure.ios.bindings.MsrObjCSpan
import sh.measure.ios.bindings.MsrSpanStatusError
import sh.measure.ios.bindings.MsrSpanStatusOk
import sh.measure.ios.bindings.MsrSpanStatusUnset
import sh.measure.kmp.attributes.AttributeValue
import sh.measure.kmp.attributes.toNative

@OptIn(ExperimentalForeignApi::class)
internal class IosSpan(internal val delegate: MsrObjCSpan) : Span {
    override val traceId: String get() = delegate.traceId()
    override val spanId: String get() = delegate.spanId()
    override val parentId: String? get() = delegate.parentId()
    override val isSampled: Boolean get() = delegate.isSampled()

    override fun setStatus(status: SpanStatus): Span = apply {
        delegate.setStatus(status.toIos())
    }

    override fun setParent(parentSpan: Span): Span = apply {
        delegate.setParent(parentSpan.unwrap())
    }

    override fun setCheckpoint(name: String): Span = apply { delegate.setCheckpoint(name) }
    override fun setName(name: String): Span = apply { delegate.setName(name) }

    override fun setAttribute(key: String, value: String): Span = apply {
        delegate.setAttributeString(key, value)
    }

    // MsrObjCSpan exposes only setAttributeInt, which cinterop projects from
    // Swift Int (== Int64 on 64-bit Apple platforms) to Kotlin Long. The Long
    // here matches the cinterop projection — no truncation.
    override fun setAttribute(key: String, value: Long): Span = apply {
        delegate.setAttributeInt(key, value)
    }

    // Same setAttributeInt destination; .toLong() is the cinterop projection
    // (Swift Int == Int64 on 64-bit), not a precision change.
    override fun setAttribute(key: String, value: Int): Span = apply {
        delegate.setAttributeInt(key, value.toLong())
    }

    override fun setAttribute(key: String, value: Double): Span = apply {
        delegate.setAttributeDouble(key, value)
    }

    override fun setAttribute(key: String, value: Boolean): Span = apply {
        delegate.setAttributeBool(key, value)
    }

    override fun setAttributes(attributes: Map<String, AttributeValue>): Span = apply {
        delegate.setAttributes(attributes.toNative())
    }

    override fun removeAttribute(key: String): Span = apply { delegate.removeAttribute(key) }

    override fun end(): Span = apply { delegate.end() }
    override fun end(timestamp: Long): Span = apply { delegate.endWithTimestamp(timestamp) }
    override fun hasEnded(): Boolean = delegate.hasEnded()
    override fun getDuration(): Long = delegate.getDuration()
}

@OptIn(ExperimentalForeignApi::class)
internal fun SpanStatus.toIos(): Long = when (this) {
    SpanStatus.Unset -> MsrSpanStatusUnset
    SpanStatus.Ok -> MsrSpanStatusOk
    SpanStatus.Error -> MsrSpanStatusError
}

@OptIn(ExperimentalForeignApi::class)
internal fun Span.unwrap(): MsrObjCSpan {
    check(this is IosSpan) {
        "Span must be created via Measure.startSpan or Measure.createSpanBuilder; " +
            "got ${this::class}"
    }
    return delegate
}
