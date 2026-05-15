package sh.measure.android.tracing

import sh.measure.android.SessionManager
import sh.measure.android.logger.Logger
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.Sampler
import sh.measure.android.utils.TimeProvider

internal class MsrTracer(
    private val logger: Logger,
    private val idProvider: IdProvider,
    private val timeProvider: TimeProvider,
    private val spanProcessor: SpanProcessor,
    private val sessionManager: SessionManager,
    private val sampler: Sampler,
) : Tracer {
    override fun spanBuilder(name: String): SpanBuilder = MsrSpanBuilder(
        name,
        idProvider,
        timeProvider,
        spanProcessor,
        sessionManager,
        sampler,
        logger,
    )

    override fun getTraceParentHeaderValue(span: Span): String {
        val sampledFlag = if (span.isSampled) "01" else "00"
        return "00-${span.traceId}-${span.spanId}-$sampledFlag"
    }

    override fun getTraceParentHeaderKey(): String = "traceparent"
}
