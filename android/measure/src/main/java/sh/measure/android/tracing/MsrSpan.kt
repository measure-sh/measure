package sh.measure.android.tracing

import sh.measure.android.SessionManager
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.TimeProvider

/**
 * A thread safe implementation of [Span].
 */
internal class MsrSpan(
    private val logger: Logger,
    private val timeProvider: TimeProvider,
    private val spanProcessor: SpanProcessor,
    override val isSampled: Boolean,
    override val name: String,
    override val spanId: String,
    override val traceId: String,
    override var parentId: String?,
    override val sessionId: String,
    override val startTime: Long,
) : ReadWriteSpan {
    private val lock = Any()
    private var status = SpanStatus.Unset
    private var endTime = 0L
    private var hasEnded: EndState = EndState.NotEnded
    override val checkpoints: MutableList<Checkpoint> = mutableListOf()
    override val attributes: MutableMap<String, Any?> = mutableMapOf()

    companion object {
        fun startSpan(
            name: String,
            logger: Logger,
            timeProvider: TimeProvider,
            spanProcessor: SpanProcessor,
            sessionManager: SessionManager,
            idProvider: IdProvider,
            traceSampler: TraceSampler,
            parentSpan: Span?,
            timestamp: Long? = null,
        ): Span {
            return InternalTrace.trace(
                { "msr-startSpan" },
                {
                    val startTime = timestamp ?: timeProvider.now()
                    val spanId: String = idProvider.spanId()
                    val traceId = parentSpan?.traceId ?: idProvider.traceId()
                    val sessionId = sessionManager.getSessionId()
                    val isSampled = parentSpan?.isSampled ?: traceSampler.shouldSample()
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
    }

    override fun getStatus(): SpanStatus {
        synchronized(lock) {
            return this.status
        }
    }

    override fun setStatus(status: SpanStatus): Span {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(LogLevel.Warning, "Attempt to set parent after span ended")
                return this
            }
            this.status = status
        }
        return this
    }

    override fun setParent(parentSpan: Span): Span {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(LogLevel.Warning, "Attempt to set parent after span ended")
                return this
            }
            this.parentId = parentSpan.spanId
        }
        return this
    }

    override fun setCheckpoint(name: String): Span {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(LogLevel.Warning, "Attempt to set parent after span ended")
                return this
            }
            val checkpoint = Checkpoint(name, timeProvider.now())
            this.checkpoints.add(checkpoint)
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

    override fun makeCurrent(): Scope {
        return SpanStorage.instance.makeCurrent(this)
    }

    private fun endSpanInternal(timestamp: Long) {
        synchronized(lock) {
            if (hasEnded != EndState.NotEnded) {
                logger.log(LogLevel.Warning, "Attempt to end a span($name) that has already ended")
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

    override fun <T> withScope(block: () -> T): T {
        return SpanStorage.instance.makeCurrent(this).use { block() }
    }

    override fun getDuration(): Long {
        synchronized(lock) {
            if (hasEnded != EndState.Ended) {
                logger.log(
                    LogLevel.Warning,
                    "Attempt to get duration of a span($name) that has not ended",
                )
                return 0
            } else {
                return calculateDuration()
            }
        }
    }

    override fun setAttribute(attribute: Pair<String, Any?>) {
        synchronized(lock) {
            if (hasEnded != EndState.Ended) {
                attributes[attribute.first] = attribute.second
            } else {
                logger.log(
                    LogLevel.Warning,
                    "Attempt to set attribute to a span($name) has ended",
                )
            }
        }
    }

    override fun getAttributesMap(): MutableMap<String, Any?> {
        synchronized(lock) {
            return attributes
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
                duration = calculateDuration(),
                isSampled = isSampled,
            )
        }
    }

    private fun calculateDuration(): Long {
        return (endTime - startTime).coerceAtLeast(0)
    }

    private enum class EndState {
        NotEnded,
        Ending,
        Ended,
    }
}
