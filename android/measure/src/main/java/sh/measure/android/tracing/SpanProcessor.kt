package sh.measure.android.tracing

import sh.measure.android.attributes.Attribute
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.SignalProcessor
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

internal interface SpanProcessor {
    fun onStart(span: InternalSpan)
    fun onEnding(span: InternalSpan)
    fun onEnded(span: InternalSpan)
}

internal class MsrSpanProcessor(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val attributeProcessors: List<AttributeProcessor>,
    private val configProvider: ConfigProvider,
) : SpanProcessor {
    override fun onStart(span: InternalSpan) {
        logger.log(LogLevel.Debug, "Starting span: ${span.name}")
        InternalTrace.trace(
            { "msr-spanProcessor-onStart" },
            {
                val threadName = Thread.currentThread().name
                span.setInternalAttribute(Attribute.THREAD_NAME to threadName)
                val attributes = span.getAttributesMap()
                attributeProcessors.forEach {
                    it.appendAttributes(attributes)
                }
            },
        )
    }

    override fun onEnding(span: InternalSpan) {
    }

    override fun onEnded(span: InternalSpan) {
        logger.log(LogLevel.Debug, "Span ended: ${span.name}")
        val spanData = span.toSpanData()
        if (!spanData.sanitize()) {
            return
        }
        signalProcessor.trackSpan(spanData)
    }

    private fun SpanData.sanitize(): Boolean {
        // discard span if it's duration is negative
        if (duration < 0) {
            logger.log(
                LogLevel.Warning,
                "Span($name) duration is negative, span will be dropped.",
            )
            return false
        }

        // discard span if it exceeds max span name length
        if (name.length > configProvider.maxSpanNameLength) {
            logger.log(
                LogLevel.Warning,
                "Span name length (${name.length} exceeded max allowed, span will be dropped.",
            )
            return false
        }

        // discard invalid checkpoints
        if (checkpoints.size > configProvider.maxCheckpointsPerSpan) {
            logger.log(
                LogLevel.Warning,
                "Max checkpoints exceeded ${checkpoints.size}, some checkpoints will be dropped.",
            )
        }

        // remove invalid checkpoints
        val initialSize = checkpoints.size
        checkpoints.removeAll { checkpoint ->
            checkpoint.name.length > configProvider.maxCheckpointNameLength
        }
        if (checkpoints.size < initialSize) {
            logger.log(
                LogLevel.Warning,
                "Dropped ${initialSize - checkpoints.size} checkpoints due to invalid name length.",
            )
        }

        // limit number of checkpoints per span
        if (checkpoints.size > configProvider.maxCheckpointsPerSpan) {
            logger.log(
                LogLevel.Warning,
                "Max checkpoints exceeded for span($name), some checkpoints will be dropped.",
            )
            checkpoints.subList(configProvider.maxCheckpointsPerSpan, checkpoints.size).clear()
        }

        // validation passed
        return true
    }
}
