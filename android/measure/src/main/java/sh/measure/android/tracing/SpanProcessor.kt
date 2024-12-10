package sh.measure.android.tracing

import sh.measure.android.attributes.Attribute
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.SignalProcessor
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

internal interface SpanProcessor {
    fun onStart(span: ReadWriteSpan)
    fun onEnding(span: ReadWriteSpan)
    fun onEnded(span: ReadWriteSpan)
}

internal class MsrSpanProcessor(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val attributeProcessors: List<AttributeProcessor>,
    private val configProvider: ConfigProvider,
) : SpanProcessor {
    override fun onStart(span: ReadWriteSpan) {
        InternalTrace.trace(
            { "msr-spanProcessor-onStart" },
            {
                val threadName = Thread.currentThread().name
                span.setAttribute(Attribute.THREAD_NAME to threadName)
                val attributes = span.getAttributesMap()
                attributeProcessors.forEach {
                    it.appendAttributes(attributes)
                }
            },
        )
    }

    override fun onEnding(span: ReadWriteSpan) {
    }

    override fun onEnded(span: ReadWriteSpan) {
        val spanData = span.toSpanData()
        if (!spanData.sanitize()) {
            return
        }
        // Log.d("MsrSpan", spanData.toString())
        signalProcessor.trackSpan(spanData)
    }

    private fun SpanData.sanitize(): Boolean {
        // discard event if it exceeds max span name length
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
        checkpoints.removeAll { checkpoint ->
            checkpoint.name.length > configProvider.maxCheckpointNameLength
        }

        // limit number of checkpoints per span
        if (checkpoints.size > configProvider.maxCheckpointsPerSpan) {
            checkpoints.subList(configProvider.maxCheckpointsPerSpan, checkpoints.size).clear()
        }

        // validation passed
        return true
    }
}
