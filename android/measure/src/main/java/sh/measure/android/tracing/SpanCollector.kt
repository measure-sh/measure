package sh.measure.android.tracing

import java.util.concurrent.atomic.AtomicBoolean

internal class SpanCollector(private val tracer: Tracer) {
    private val isEnabled = AtomicBoolean(false)

    fun register() {
        isEnabled.set(true)
    }

    fun unregister() {
        isEnabled.set(false)
    }

    fun getTraceParentHeaderValue(span: Span): String {
        return tracer.getTraceParentHeaderValue(span)
    }

    fun getTraceParentHeaderKey(): String {
        return tracer.getTraceParentHeaderKey()
    }

    fun createSpan(name: String): SpanBuilder? {
        if (!isEnabled.get()) {
            return null
        }
        return tracer.spanBuilder(name)
    }

    fun startSpan(name: String, setNoParent: Boolean = false, timestamp: Long? = null): Span {
        if (!isEnabled.get()) {
            return Span.invalid()
        }

        val spanBuilder = tracer.spanBuilder(name)
        if (setNoParent) {
            spanBuilder.setNoParent()
        }
        if (timestamp != null) {
            spanBuilder.startSpan(timestamp)
        }
        return spanBuilder.startSpan()
    }

    fun getCurrentSpan(): Span? {
        if (!isEnabled.get()) {
            return null
        }
        return Span.current()
    }
}
