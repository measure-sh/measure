package sh.measure.android.utils

import sh.measure.android.SessionManager
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.SignalProcessor
import sh.measure.android.logger.Logger
import sh.measure.android.tracing.MsrSpanBuilder
import sh.measure.android.tracing.MsrSpanProcessor
import sh.measure.android.tracing.Span
import sh.measure.android.tracing.SpanBuilder
import sh.measure.android.tracing.Tracer

internal class TestTracer(
    signalProcessor: SignalProcessor,
    configProvider: ConfigProvider,
    private val logger: Logger,
    private val timeProvider: TimeProvider,
    private val sessionManager: SessionManager,
) : Tracer {
    private val idProvider = IdProviderImpl(RandomizerImpl())
    private val sampler = FakeSampler()
    private val spanProcessor = MsrSpanProcessor(
        logger,
        signalProcessor,
        listOf(),
        configProvider,
        sampler,
    )

    init {
        // Ensure config is loaded so that spans
        // are processed immediately
        spanProcessor.onConfigLoaded()
    }

    override fun spanBuilder(name: String): SpanBuilder = MsrSpanBuilder(
        name,
        spanProcessor = spanProcessor,
        timeProvider = timeProvider,
        idProvider = idProvider,
        sessionManager = sessionManager,
        sampler = sampler,
        logger = logger,
    )

    override fun getTraceParentHeaderValue(span: Span): String = "00-${span.traceId}-${span.spanId}-${0}"

    override fun getTraceParentHeaderKey(): String = "traceparent"
}
