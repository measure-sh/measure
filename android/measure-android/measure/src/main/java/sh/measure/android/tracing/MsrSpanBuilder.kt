package sh.measure.android.tracing

import sh.measure.android.SessionManager
import sh.measure.android.logger.Logger
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.Sampler
import sh.measure.android.utils.TimeProvider

internal class MsrSpanBuilder(
    val name: String,
    private val idProvider: IdProvider,
    private val timeProvider: TimeProvider,
    private val spanProcessor: SpanProcessor,
    private val sessionManager: SessionManager,
    private val sampler: Sampler,
    private val logger: Logger,
) : SpanBuilder {
    private var parentSpan: Span? = null

    override fun setParent(span: Span): SpanBuilder {
        this.parentSpan = span
        return this
    }

    override fun startSpan(): Span = MsrSpan.startSpan(
        name = name,
        logger = logger,
        timeProvider = timeProvider,
        spanProcessor = spanProcessor,
        sessionManager = sessionManager,
        idProvider = idProvider,
        parentSpan = parentSpan,
        sampler = sampler,
    )

    override fun startSpan(timeMs: Long): Span {
        val span = MsrSpan.startSpan(
            name = name,
            logger = logger,
            timeProvider = timeProvider,
            idProvider = idProvider,
            spanProcessor = spanProcessor,
            sessionManager = sessionManager,
            parentSpan = parentSpan,
            timestamp = timeMs,
            sampler = sampler,
        )
        return span
    }
}
