package sh.measure.android.tracing

import sh.measure.android.attributes.Attribute
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.SignalProcessor
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.Sampler

internal interface SpanProcessor {
    fun onStart(span: InternalSpan)
    fun onEnding(span: InternalSpan)
    fun onEnded(span: InternalSpan)
    fun onConfigLoaded()
}

internal class MsrSpanProcessor(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val attributeProcessors: List<AttributeProcessor>,
    private val configProvider: ConfigProvider,
    private val sampler: Sampler,
) : SpanProcessor {
    private val bufferLock = Any()

    // Buffer for spans until config is loaded
    // Once the config is loaded, we flush the buffer
    // and set spansBuffer to null
    private var spansBuffer: MutableList<InternalSpan>? = mutableListOf()

    override fun onStart(span: InternalSpan) {
        InternalTrace.trace(
            { "msr-spanProcessor-onStart" },
            {
                logger.log(LogLevel.Debug, "SpanProcessor: span started ${span.name}")
                val threadName = Thread.currentThread().name
                span.setInternalAttribute(Attribute.THREAD_NAME to threadName)
                val attributes = span.getAttributesMap()
                attributeProcessors.forEach {
                    it.appendAttributes(attributes)
                }
                synchronized(bufferLock) {
                    spansBuffer?.add(span)
                }
            },
        )
    }

    override fun onEnding(span: InternalSpan) {
    }

    override fun onEnded(span: InternalSpan) {
        val isConfigLoaded = synchronized(bufferLock) { spansBuffer == null }
        if (!isConfigLoaded) {
            val spanData = span.toSpanData()
            if (!spanData.sanitize()) {
                synchronized(bufferLock) {
                    spansBuffer?.remove(span)
                }
                return
            }
            logger.log(
                LogLevel.Debug,
                "SpanProcessor: span ended: ${span.name}, waiting for config to load for further processing",
            )
            return
        }

        processSpan(span)
    }

    override fun onConfigLoaded() {
        val pending = synchronized(bufferLock) {
            spansBuffer?.also { spansBuffer = null }
        } ?: return

        if (pending.isEmpty()) {
            return
        }

        logger.log(
            LogLevel.Debug,
            "SpanProcessor: processing ${pending.size} buffered spans",
        )

        pending.forEach { span ->
            val shouldSample = sampler.shouldSampleTrace(span.traceId)
            span.setSamplingRate(shouldSample)

            if (span.hasEnded()) {
                processSpan(span)
            }
        }
    }

    private fun processSpan(span: InternalSpan) {
        val spanData = span.toSpanData()
        if (!spanData.sanitize()) {
            return
        }
        signalProcessor.trackSpan(spanData)
        logger.log(
            LogLevel.Debug,
            "SpanProcessor: span ended: ${spanData.name}, duration: ${spanData.duration}",
        )
    }

    private fun SpanData.sanitize(): Boolean {
        // discard span if it's duration is negative
        if (duration < 0) {
            logger.log(
                LogLevel.Error,
                "SpanProcessor: invalid span $name, duration is negative, span will be dropped",
            )
            return false
        }

        // discard span if it is empty
        if (name.isBlank()) {
            logger.log(
                LogLevel.Error,
                "SpanProcessor: span name is does not contain any characters, span will be dropped",
            )
            return false
        }

        // discard span if it exceeds max span name length
        if (name.length > configProvider.maxSpanNameLength) {
            logger.log(
                LogLevel.Error,
                "SpanProcessor: invalid span: $name, length ${name.length} exceeded max allowed, span will be dropped",
            )
            return false
        }

        // remove invalid checkpoints
        val initialSize = checkpoints.size
        checkpoints.removeAll { checkpoint ->
            checkpoint.name.length > configProvider.maxCheckpointNameLength
        }
        if (checkpoints.size < initialSize) {
            logger.log(
                LogLevel.Error,
                "SpanProcessor: invalid span $name, dropped ${initialSize - checkpoints.size} checkpoints due to invalid name",
            )
        }

        // limit number of checkpoints per span
        if (checkpoints.size > configProvider.maxCheckpointsPerSpan) {
            logger.log(
                LogLevel.Error,
                "SpanProcessor: invalid span $name, max checkpoints exceeded, some checkpoints will be dropped",
            )
            checkpoints.subList(configProvider.maxCheckpointsPerSpan, checkpoints.size).clear()
        }

        // remove invalid user-defined attributes
        val attrsIterator = userDefinedAttrs.entries.iterator()
        var droppedAttrsCount = 0
        while (attrsIterator.hasNext()) {
            val (key, value) = attrsIterator.next()
            if (key.length > configProvider.maxUserDefinedAttributeKeyLength ||
                (value is String && value.length > configProvider.maxUserDefinedAttributeValueLength)
            ) {
                attrsIterator.remove()
                droppedAttrsCount++
            }
        }
        if (droppedAttrsCount > 0) {
            logger.log(
                LogLevel.Error,
                "SpanProcessor: invalid span $name attributes, dropped $droppedAttrsCount attributes due to invalid key or value length",
            )
        }

        // limit number of user-defined attributes per span
        if (userDefinedAttrs.size > configProvider.maxUserDefinedAttributesPerEvent) {
            val excessCount = userDefinedAttrs.size - configProvider.maxUserDefinedAttributesPerEvent
            logger.log(
                LogLevel.Error,
                "SpanProcessor: invalid span $name attributes, max attributes exceeded, $excessCount attributes will be dropped",
            )
            val keysToKeep = userDefinedAttrs.keys.take(configProvider.maxUserDefinedAttributesPerEvent)
            userDefinedAttrs.keys.retainAll(keysToKeep)
        }

        // validation passed
        return true
    }
}
