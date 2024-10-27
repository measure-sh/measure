package sh.measure.android.tracing

internal class InvalidSpan : Span {
    override val traceId: String = "invalid-trace-id"
    override val spanId: String = "invalid-span-id"
    override val name: String = "invalid"

    override val parentId: String? = null
    override val startTime: Long = 0

    override fun getStatus(): SpanStatus {
        return SpanStatus.Unset
    }

    override fun setStatus(status: SpanStatus): Span {
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

    override fun makeCurrent(): Scope {
        return NoopScope()
    }

    override fun <T> withScope(block: () -> T): T {
        return block()
    }
}
