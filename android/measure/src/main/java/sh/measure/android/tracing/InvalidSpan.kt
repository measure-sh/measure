package sh.measure.android.tracing

internal class InvalidSpan : Span {
    override val traceId: String = "invalid-trace-id"
    override val spanId: String = "invalid-span-id"
    override val isSampled: Boolean = false
    override val parentId: String? = null

    override fun setStatus(status: SpanStatus): Span {
        return this
    }

    override fun setParent(parentSpan: Span): Span {
        return this
    }

    override fun setCheckpoint(name: String): Span {
        return this
    }

    override fun setName(name: String): Span {
        return this
    }

    override fun end(): Span {
        return this
    }

    override fun end(timestamp: Long): Span {
        return this
    }

    override fun hasEnded(): Boolean {
        return false
    }

    override fun getDuration(): Long {
        return 0
    }
}
