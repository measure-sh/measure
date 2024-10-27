package sh.measure.android.tracing

import android.util.Log
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
    override val name: String,
    override val spanId: String,
    override val traceId: String,
    override val parentId: String?,
    override val startTime: Long,
) : Span {
    private val lock = Any()
    private var status = SpanStatus.Unset
    private var endTime = 0L
    private var hasEnded: EndState = EndState.NotEnded
    private var duration: Long = 0

    companion object {
        fun startSpan(
            name: String,
            logger: Logger,
            timeProvider: TimeProvider,
            idProvider: IdProvider,
            parentSpan: Span?,
            timestamp: Long? = null,
        ): Span {
            val startTime = timestamp ?: timeProvider.now()
            val spanId: String = idProvider.createId()
            val traceId = parentSpan?.traceId ?: idProvider.createId()
            return MsrSpan(
                logger = logger,
                timeProvider = timeProvider,
                name = name,
                spanId = spanId,
                traceId = traceId,
                parentId = parentSpan?.spanId,
                startTime = startTime,
            )
        }
    }

    override fun getStatus(): SpanStatus {
        return this.status
    }

    override fun setStatus(status: SpanStatus): Span {
        synchronized(lock) {
            this.status = status
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
                logger.log(LogLevel.Warning, "Attempt to end a span($name) that has already ended")
                return
            }
            endTime = timestamp
            hasEnded = EndState.Ending
        }

        // trigger onEnding
        synchronized(lock) {
            hasEnded = EndState.Ended
        }

        // trigger onEnded
        Log.i("MsrSpan", "${this.toSpanData()}")
    }

    override fun makeCurrent(): Scope {
        return SpanStorage.instance.makeCurrent(this)
    }

    override fun <T> withScope(block: () -> T): T {
        return makeCurrent().use { block() }
    }

    override fun getDuration(): Long {
        return duration
    }

    private enum class EndState {
        NotEnded,
        Ending,
        Ended,
    }

    private fun toSpanData(): SpanData {
        synchronized(lock) {
            this.duration = (endTime - startTime).coerceAtLeast(0)
            return SpanData(
                spanId = spanId,
                name = name,
                startTime = startTime,
                endTime = endTime,
                status = status,
                hasEnded = hasEnded == EndState.Ended,
                parentId = parentId,
                duration = duration,
            )
        }
    }
}
