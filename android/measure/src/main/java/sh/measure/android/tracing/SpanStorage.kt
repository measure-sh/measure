package sh.measure.android.tracing

import android.util.Log

/**
 * Stores current span as a thread local variable.
 */
internal class SpanStorage private constructor() {
    private val currentSpan = ThreadLocal<Span?>()

    internal companion object {
        val instance = SpanStorage()
    }

    fun makeCurrent(span: Span): Scope {
        val scope = ScopeImpl(beforeAttach = current(), toAttach = span)
        currentSpan.set(span)
        return scope
    }

    fun current(): Span? {
        return currentSpan.get()
    }

    inner class ScopeImpl(private val beforeAttach: Span?, private val toAttach: Span) : Scope {
        private var closed = false

        override fun close() {
            if (!closed && current() === toAttach) {
                closed = true
                currentSpan.set(beforeAttach)
            } else {
                Log.i(
                    "MsrSpan",
                    "Trying to close scope which does not represent current context. Ignoring the call.",
                )
            }
        }
    }
}

internal class NoopScope : Scope {
    override fun close() {
        // No-op
    }
}
