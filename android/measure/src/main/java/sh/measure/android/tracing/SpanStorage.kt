package sh.measure.android.tracing

/**
 * Stores current span as a thread local variable.
 */
internal class SpanStorage private constructor() {
    private val currentSpan = ThreadLocal<Span?>()

    internal companion object {
        val instance = SpanStorage()
    }

    fun makeCurrent(span: Span): Scope {
        val scope = ScopeImpl()
        currentSpan.set(span)
        return scope
    }

    fun current(): Span? {
        return currentSpan.get()
    }

    internal inner class ScopeImpl : Scope {
        private val previousSpan = currentSpan.get()

        override fun close() {
            currentSpan.set(previousSpan)
        }
    }
}

internal class NoopScope : Scope {
    override fun close() {
        // No-op
    }
}
