package sh.measure.android.tracing

class InvalidSpan : Span {
    override val traceId: String = "invalid-trace-id"
    override val spanId: String = "invalid-span-id"
    override val name: String = "invalid"

    override fun setStatus(status: SpanStatus): Span {
        return this
    }

    override fun end(): Span {
        return this
    }

    override fun end(timeMs: Long): Span {
        return this
    }

    override fun hasEnded(): Boolean {
        return false
    }

    override fun makeCurrent(): Scope {
        return NoopScope()
    }
}