package sh.measure.android.tracing

import sh.measure.android.attributes.AttributeValue

internal class InvalidSpan : Span {
    override val traceId: String = "invalid-trace-id"
    override val spanId: String = "invalid-span-id"
    override val isSampled: Boolean = false
    override val parentId: String? = null

    override fun setStatus(status: SpanStatus): Span = this

    override fun setParent(parentSpan: Span): Span = this

    override fun setCheckpoint(name: String): Span = this

    override fun setName(name: String): Span = this

    override fun setAttribute(key: String, value: String): Span = this

    override fun setAttribute(key: String, value: Long): Span = this

    override fun setAttribute(key: String, value: Int): Span = this

    override fun setAttribute(key: String, value: Double): Span = this

    override fun setAttribute(key: String, value: Boolean): Span = this

    override fun setAttributes(attributes: Map<String, AttributeValue>): Span = this

    override fun removeAttribute(key: String): Span = this

    override fun end(): Span = this

    override fun end(timestamp: Long): Span = this

    override fun hasEnded(): Boolean = false

    override fun getDuration(): Long = 0
}
