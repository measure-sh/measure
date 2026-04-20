package sh.measure.android.tracing

import sh.measure.android.SessionManager
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.Sampler
import sh.measure.android.utils.TimeProvider

/**
 * A thread safe implementation of [Span].
 */
internal class MsrSpan(
    private val logger: Logger,
    private val timeProvider: TimeProvider,
    private val spanProcessor: SpanProcessor,
    override var isSampled: Boolean,
    override var name: String,
    override val spanId: String,
    override var traceId: String,
    override var parentId: String?,
    override val sessionId: String,
    override val startTime: Long,
) : InternalSpan {
    private val lock = Any()
    private var status = SpanStatus.Unset
    private var endTime = 0L
    private var hasEnded: EndState = EndState.NotEnded
    override val checkpoints: MutableList<Checkpoint> = mutableListOf()
    override val attributes: MutableMap<String, Any?> = mutableMapOf()
    private val userDefinedAttrs: MutableMap<String, Any?> = mutableMapOf()

    companion object {
        fun startSpan(
            name: String,
            logger: Logger,
            timeProvider: TimeProvider,
            spanProcessor: SpanProcessor,
            sessionManager: SessionManager,
            idProvider: IdProvider,
            sampler: Sampler,
            parentSpan: Span?,
            timestamp: Long? = null,
        ): Span = InternalTrace.trace(
            { "msr-startSpan" },
            {
                val startTime = timestamp ?: timeProvider.now()
                val spanId: String = idProvider.spanId()
                val traceId = parentSpan?.traceId ?: idProvider.traceId()
                val sessionId = sessionManager.getSessionId()
                val isSampled = parentSpan?.isSampled ?: sampler.shouldSampleTrace(traceId)
                val span = MsrSpan(
                    logger = logger,
                    timeProvider = timeProvider,
                    spanProcessor = spanProcessor,
                    name = name,
                    spanId = spanId,
                    traceId = traceId,
                    parentId = parentSpan?.spanId,
                    sessionId = sessionId,
                    startTime = startTime,
                    isSampled = isSampled,
                )
                spanProcessor.onStart(span)
                span
            },
        )
    }

    override fun getStatus(): SpanStatus {
        synchronized(lock) {
            return this.status
        }
    }

    override fun setStatus(status: SpanStatus): Span {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(
                    LogLevel.Error,
                    "Failed to update span: attempt to set status after span ended",
                )
                return this
            }
            this.status = status
        }
        return this
    }

    override fun setParent(parentSpan: Span): Span {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(
                    LogLevel.Error,
                    "Failed to update span: attempt to set parent after span ended",
                )
                return this
            }
            this.parentId = parentSpan.spanId
            this.traceId = parentSpan.traceId
        }
        return this
    }

    override fun setCheckpoint(name: String): Span {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(
                    LogLevel.Error,
                    "Failed to update span: attempt to set checkpoint after span ended",
                )
                return this
            }
            val checkpoint = Checkpoint(name, timeProvider.now())
            this.checkpoints.add(checkpoint)
        }
        return this
    }

    override fun setName(name: String): Span {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(
                    LogLevel.Error,
                    "Failed to update span: attempt to set name after span ended",
                )
                return this
            }
            this.name = name
        }
        return this
    }

    override fun setSamplingRate(sampled: Boolean) {
        synchronized(lock) {
            // Allow updating ended spans too
            // to account for lazy sampling
            // config loading.
            this.isSampled = sampled
        }
    }

    override fun setAttribute(key: String, value: String): Span {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(
                    LogLevel.Error,
                    "Failed to update span: attempt to set attribute after span ended",
                )
                return this
            }
            this.userDefinedAttrs[key] = value
        }
        return this
    }

    override fun setAttribute(key: String, value: Long): Span {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(
                    LogLevel.Error,
                    "Failed to update span: attempt to set attribute after span ended",
                )
                return this
            }
            this.userDefinedAttrs[key] = value
        }
        return this
    }

    override fun setAttribute(key: String, value: Int): Span {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(
                    LogLevel.Error,
                    "Failed to update span: attempt to set attribute after span ended",
                )
                return this
            }
            this.userDefinedAttrs[key] = value
        }
        return this
    }

    override fun setAttribute(key: String, value: Double): Span {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(
                    LogLevel.Error,
                    "Failed to update span: attempt to set attribute after span ended",
                )
                return this
            }
            this.userDefinedAttrs[key] = value
        }
        return this
    }

    override fun setAttribute(key: String, value: Boolean): Span {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(
                    LogLevel.Error,
                    "Failed to update span: attempt to set attribute after span ended",
                )
                return this
            }
            this.userDefinedAttrs[key] = value
        }
        return this
    }

    override fun setAttributes(attributes: Map<String, AttributeValue>): Span {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(
                    LogLevel.Error,
                    "Failed to update span: attempt to set attribute after span ended",
                )
                return this
            }
            attributes.forEach { (key, value) ->
                this.userDefinedAttrs[key] = value.value
            }
        }
        return this
    }

    override fun removeAttribute(key: String): Span {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(
                    LogLevel.Error,
                    "Failed to update span: attempt to set attribute after span ended",
                )
                return this
            }
            this.userDefinedAttrs.remove(key)
        }
        return this
    }

    override fun end(): Span {
        endSpanInternal(timeProvider.now())
        return this
    }

    override fun end(timestamp: Long): Span {
        endSpanInternal(timestamp)
        return this
    }

    override fun hasEnded(): Boolean {
        synchronized(lock) {
            return hasEnded != EndState.NotEnded
        }
    }

    private fun endSpanInternal(timestamp: Long) {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(
                    LogLevel.Error,
                    "Failed to update span: attempt to end and already ended span",
                )
                return
            }
            endTime = timestamp
            hasEnded = EndState.Ending
        }
        spanProcessor.onEnding(this)
        synchronized(lock) {
            hasEnded = EndState.Ended
        }
        spanProcessor.onEnded(this)
    }

    override fun getDuration(): Long {
        synchronized(lock) {
            if (hasEnded != EndState.Ended) {
                logger.log(
                    LogLevel.Error,
                    "Failed to get duration of a span($name): span has not ended",
                )
                return 0
            } else {
                return calculateDuration()
            }
        }
    }

    override fun setInternalAttribute(attribute: Pair<String, Any?>) {
        synchronized(lock) {
            if (hasEnded != EndState.Ended) {
                attributes[attribute.first] = attribute.second
            } else {
                logger.log(
                    LogLevel.Error,
                    "Failed to update span: attempt to set attribute after span ended",
                )
            }
        }
    }

    override fun getAttributesMap(): MutableMap<String, Any?> {
        synchronized(lock) {
            return attributes
        }
    }

    override fun getUserDefinedAttrs(): MutableMap<String, Any?> {
        synchronized(lock) {
            return userDefinedAttrs
        }
    }

    override fun toSpanData(): SpanData {
        synchronized(lock) {
            return SpanData(
                spanId = spanId,
                traceId = traceId,
                name = name,
                startTime = startTime,
                endTime = endTime,
                status = status,
                hasEnded = hasEnded == EndState.Ended,
                parentId = parentId,
                sessionId = sessionId,
                checkpoints = checkpoints,
                attributes = attributes,
                userDefinedAttrs = userDefinedAttrs,
                duration = calculateDuration(),
                isSampled = isSampled,
            )
        }
    }

    private fun calculateDuration(): Long = endTime - startTime

    private enum class EndState {
        NotEnded,
        Ending,
        Ended,
    }
}
