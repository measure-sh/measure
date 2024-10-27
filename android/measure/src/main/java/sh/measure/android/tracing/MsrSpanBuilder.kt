package sh.measure.android.tracing

import sh.measure.android.logger.Logger
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.TimeProvider

internal class MsrSpanBuilder(
    val name: String,
    private val idProvider: IdProvider,
    private val timeProvider: TimeProvider,
    private val logger: Logger,
) : SpanBuilder {
    private var parentSpan: Span? = null
    private var setNoParent: Boolean = false

    override fun setParent(span: Span): SpanBuilder {
        this.parentSpan = span
        return this
    }

    override fun setNoParent(): SpanBuilder {
        setNoParent = true
        return this
    }

    override fun startSpan(): Span {
        val parent = findSpanParent()
        return MsrSpan.startSpan(
            name,
            logger,
            timeProvider,
            idProvider,
            parentSpan = parent,
        )
    }

    override fun startSpan(timestamp: Long): Span {
        val parent = findSpanParent()
        return MsrSpan.startSpan(
            name = name,
            logger = logger,
            timeProvider = timeProvider,
            idProvider = idProvider,
            parentSpan = parent,
            timestamp = timestamp,
        )
    }

    private fun findSpanParent(): Span? {
        if (setNoParent) {
            return null
        }
        if (parentSpan != null) {
            return parentSpan
        }
        return Span.current()
    }
}
