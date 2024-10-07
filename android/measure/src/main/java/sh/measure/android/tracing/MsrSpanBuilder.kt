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
    override fun startSpan(): Span {
        return MsrSpan.startSpan(name, logger, timeProvider, idProvider, null)
    }

    override fun startSpan(timeMs: Long): Span {
        return MsrSpan.startSpan(name, logger, timeProvider, idProvider, timeMs)
    }
}
